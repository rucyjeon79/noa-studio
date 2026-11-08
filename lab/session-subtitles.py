"""Local N80 session tool: time registered lyrics against actual recognized words.

No paid API, equal-duration timing, translated lyrics or background queue.
The caller saves payload through the existing N80 agent lease/revision contract.
"""
import argparse
import difflib
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import unicodedata


def lyric_lines(text):
    lines = []
    for raw in str(text).splitlines():
        line = re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]", "", raw)).strip()
        # Suno production directions are not sung lyrics. Preserve ordinary
        # parenthetical lyrics/adlibs; only explicit full-line directions match.
        if (line.startswith('(') and line.endswith(')') and re.search(
                r'\b(?:sogeum|gayageum|ajaeng|janggu|kkwaenggwari|taepyeongso|instrumentation|'
                r'percussion|arpeggio|glissando|harmonics|sub bass|vocal|vocals|whispered)\b', line, re.I)):
            continue
        if line:
            lines.append(line)
    return lines


def clean(text):
    return "".join(c for c in unicodedata.normalize("NFKC", text).lower() if c.isalnum())


def file_sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1048576), b""):
            h.update(chunk)
    return h.hexdigest()


def usable_recognized_words(words, duration):
    """Quarantine unusable native-ASR words; never stretch or invent timings."""
    usable, discarded, previous = [], 0, 0.0
    for word in words:
        if not clean(str(word.get('word', ''))):
            continue
        start, end, probability = (word.get(k) for k in ('start', 'end', 'probability'))
        if (not all(isinstance(x, (int, float)) and math.isfinite(x) for x in (start, end, probability))
                or start < previous or end <= start or end > duration + .05 or not 0 <= probability <= 1):
            discarded += 1
            continue
        usable.append(word)
        previous = start
    return usable, discarded


def match_lyrics(lyrics, words, duration):
    lines = lyric_lines(lyrics)
    if not lines or not re.search(r"[가-힣]", "".join(lines)):
        raise ValueError("korean_lyrics_required")
    if len(lines) > 500 or sum(map(len, lines)) > 20000:
        raise ValueError("lyrics_too_large")
    recognized, owners, valid = "", [], []
    previous = 0.0
    for word in words:
        start, end = word.get("start"), word.get("end")
        probability = word.get("probability", 0)
        if (not all(isinstance(x, (int, float)) and math.isfinite(x) for x in [start, end, probability])
                or start < previous or end <= start or end > duration + .05 or not 0 <= probability <= 1):
            raise ValueError("invalid_word_timestamps")
        previous = start
        text = clean(str(word.get("word", "")))
        if not text:
            continue
        owners.extend([len(valid)] * len(text))
        recognized += text
        valid.append({"start": start, "end": min(duration, end), "probability": probability})
    if len(recognized) > 40000:
        raise ValueError("transcript_too_large")
    expected = "".join(map(clean, lines))
    # Global, ordered matching keeps repeated chorus occurrences distinct.
    mapping = {}
    for block in difflib.SequenceMatcher(None, expected, recognized, autojunk=False).get_matching_blocks():
        for offset in range(block.size):
            mapping[block.a + offset] = owners[block.b + offset]
    cues, issues, cursor, previous_end = [], [], 0, 0
    for number, line in enumerate(lines, 1):
        text = clean(line)
        hits = [mapping[i] for i in range(cursor, cursor + len(text)) if i in mapping]
        cursor += len(text)
        ratio = len(hits) / max(1, len(text))
        if not hits or ratio < .55:
            issues.append({"line": number, "reason": "voice_not_matched"})
            continue
        indexes = sorted(set(hits))
        used = [valid[i] for i in indexes]
        start = round(used[0]["start"] * 1000)
        end = round(used[-1]["end"] * 1000)
        probability = sum(w["probability"] for w in used) / len(used)
        gap = max([valid[b]["start"] - valid[a]["end"] for a, b in zip(indexes, indexes[1:])] or [0])
        # Never shift a dubious cue or fill an instrumental gap to make it pass.
        if start < previous_end or end <= start:
            issues.append({"line": number, "reason": "overlapping_words"})
            continue
        cue = {"line": number, "startMs": start, "endMs": end, "text": line,
               "match": round(ratio, 4), "probability": round(probability, 4),
               "maxWordGapMs": round(max(0, gap) * 1000)}
        cues.append(cue)
        previous_end = end
        if ratio < .85 or probability < .55 or end - start > 15000 or gap > 1.8:
            issues.append({"line": number, "reason": "timing_needs_review"})
    return {"cues": cues, "lineCount": len(lines), "issues": issues,
            "complete": len(cues) == len(lines), "ready": len(cues) == len(lines) and not issues}


def produce(manifest, transcript=None, model="small", cache_dir=None):
    audio = Path(manifest["audio"]["path"])
    sha = file_sha(audio)
    if sha != manifest["audio"]["sha256"]:
        raise ValueError("audio_checksum_mismatch")
    duration = float(manifest["duration"])
    if not math.isfinite(duration) or not 0 < duration <= 3600:
        raise ValueError("invalid_duration")
    probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_format", "-of", "json", str(audio)]))
    if abs(float(probe["format"]["duration"]) - duration) > .15:
        raise ValueError("audio_duration_mismatch")
    lyrics = manifest["lyrics"]
    if not re.search(r"[가-힣]", "".join(lyric_lines(lyrics))):
        raise ValueError("korean_lyrics_required")
    discarded = 0
    if transcript is None:
        from faster_whisper import WhisperModel
        recognizer = WhisperModel(model, device="cpu", compute_type="int8", cpu_threads=4,
                                  download_root=cache_dir)
        import numpy as np
        pcm = subprocess.check_output(["ffmpeg", "-v", "error", "-xerror", "-nostdin", "-i", str(audio), "-map", "0:a:0", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"])
        samples = np.frombuffer(pcm, dtype=np.float32)
        segments, _ = recognizer.transcribe(samples, language="ko", beam_size=5,
                                           word_timestamps=True, vad_filter=False,
                                           condition_on_previous_text=False)
        words = [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability}
                 for segment in segments for w in segment.words or []]
        words, discarded = usable_recognized_words(words, duration)
        method = "faster-whisper"
    else:
        words = transcript["words"]
        if transcript.get("sourceAudioSha256") != sha:
            raise ValueError("transcript_source_mismatch")
        method = "timestamped-asr"
    matched = match_lyrics(lyrics, words, duration)
    if discarded:
        matched['ready'] = False
        matched['issues'].append({'reason': 'recognizer_words_unusable', 'count': discarded})
    payload = {"sourceAudioSha256": sha, "lyricsSha256": hashlib.sha256(lyrics.encode()).hexdigest(),
               "method": method, "model": model, "cues": matched["cues"], "recognitionDiscardedWords": discarded}
    return {"version": 1, "payload": payload, "diagnostics": {k: v for k, v in matched.items() if k != "cues"}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest")
    parser.add_argument("output")
    parser.add_argument("--model", choices=["small", "medium", "large-v3", "large-v3-turbo"], default="small")
    parser.add_argument("--cache-dir")
    parser.add_argument("--transcript", help="Reuse an already measured, audio-hash-bound word transcript")
    args = parser.parse_args()
    manifest = json.loads(Path(args.manifest).read_text())
    transcript = json.loads(Path(args.transcript).read_text()) if args.transcript else None
    failed = False
    try:
        result = produce(manifest, transcript, args.model, args.cache_dir)
    except Exception as error:
        # Return typed evidence, never a raw provider exception/URL or file contents.
        reasons = {'audio_checksum_mismatch', 'invalid_duration', 'audio_duration_mismatch', 'korean_lyrics_required',
                   'lyrics_too_large', 'invalid_word_timestamps', 'transcript_too_large', 'transcript_source_mismatch'}
        reason = str(error) if isinstance(error, ValueError) and str(error) in reasons else 'recognition_dependency_failed'
        result = {'error': reason, 'errorType': type(error).__name__}
        failed = True
    output = Path(args.output)
    temp = output.with_suffix(output.suffix + ".partial")
    temp.write_text(json.dumps(result, ensure_ascii=False, indent=2))
    os.replace(temp, output)
    print(json.dumps({"file": str(output), **(result if failed else result["diagnostics"])}, ensure_ascii=False))
    if failed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
