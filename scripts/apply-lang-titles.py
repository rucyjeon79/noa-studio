#!/usr/bin/env python3
"""Unconfirmed songs only. Convert titles, rebuild YouTube titles, replace copied or wrong-language lyrics."""
import json, glob, os, re

ROOT = "/workspace/data/live/곡"
FLAGS = set(json.load(open("/workspace/data/live/앱관리/확정.json", encoding="utf-8")))
REWRITE = {"jpop-original", "pop-original", "thai-original", "joseon-ballad", "groovy-airy-pop", "narrative-piano-indie"}
KO_GENRES = {"panpop", "echoes-of-joseon", "dreamy-deep-house", "latin-afrobeats-edm", "edm-kpop-club", "fantasy-ambient-edm", "joseon-ballad"}
LABEL = {
    "kpop-original": "K-POP Original Song",
    "jpop-original": "J-POP Original Song",
    "pop-original": "POP Original Song",
    "thai-original": "Thai Original Song",
    "joseon-ballad": "조선 발라드",
    "panpop": "PANPOP : The New Korean Pop",
    "echoes-of-joseon": "Echoes of Joseon",
    "latin-afrobeats-edm": "Latin Afrobeats EDM",
    "edm-kpop-club": "EDM K-POP Club Remix",
    "dreamy-deep-house": "Dreamy Deep House",
    "fantasy-ambient-edm": "Fantasy Ambient EDM",
    "groovy-airy-pop": "Groovy Airy POP",
    "narrative-piano-indie": "Narrative Piano Indie",
}
# ep -> ja, en, th, groovy, narrative. Empty means keep a title that is already in the target language.
JA = {
    "01": "一日の終りに", "02": "私はまた生きる", "03": "光で君を", "04": "世界の果てでも",
    "05": "君とのすべての瞬間", "06": "覚えている", "07": "まだあの場所で", "08": "崩れゆく日々",
    "09": "光の場所", "10": "還魂の歌", "11": "独り言", "12": "深淵", "13": "井戸に落ちた月",
    "14": "残響", "15": "すれ違う真心", "16": "冷たい響き", "17": "ごめんね", "18": "一言もなく",
    "19": "近づくほど", "20": "舞い上がる", "21": "二つ目の炎", "22": "一日の終わり、再び",
    "23": "触れたい", "24": "灯をともして", "25": "朝へ舞い上がる", "26": "夜空へ舞い上がる",
    "27": "最後の飛翔", "28": "炎の嵐", "29": "どこまでも高く", "30": "星になる夜",
    "31": "愛が染みた日", "32": "小さな震え", "33": "心の目", "34": "並んで",
    "35": "残る", "36": "残された場所", "37": "遅い足音", "38": "揺れ",
    "39": "もしかして", "40": "残光",
}
EN = {
    "01": "End of the Day", "02": "I Live Again", "03": "Light for You", "04": "Even at the World's End",
    "05": "Every Moment with You", "06": "Remember", "07": "Still There", "08": "Days That Crumbled",
    "09": "Where the Light Rests", "10": "Song of Returning Souls", "11": "Talking to Myself",
    "12": "The Depths", "13": "Moon in the Well", "14": "Aftertone", "15": "Crossed Hearts",
    "16": "Cold Echo", "17": "The Sorry I Swallowed", "18": "Without a Word", "19": "The Closer You Are",
    "20": "Taking Flight", "21": "Second Flame", "22": "Reborn Dusk", "23": "Touch You",
    "24": "Light It Up", "25": "Rise, Morning", "26": "Rise, Night Sky", "27": "Rise, Final",
    "28": "Blazestorm", "29": "Skyhigh", "30": "Becoming Stars", "31": "The Day Love Soaked In",
    "32": "A Small Tremor", "33": "Grain of the Heart", "34": "Side by Side", "35": "Remain",
    "36": "The Place Left Behind", "37": "Slow Steps", "38": "Sway", "39": "Maybe", "40": "Afterglow",
}
TH = {
    "01": "ในตอนท้ายของวัน", "02": "ฉันมีชีวิตอีกครั้ง", "03": "แสงเพื่อเธอ", "04": "แม้สุดขอบโลก",
    "05": "ทุกช่วงเวลาที่มีเธอ", "06": "ยังจำได้", "07": "ยังอยู่ที่เดิม", "08": "วันที่พังทลาย",
    "09": "ที่ซึ่งแสงพักอยู่", "10": "เพลงคืนวิญญาณ", "11": "พูดกับตัวเอง", "12": "ห้วงลึก",
    "13": "จันทร์ในบ่อน้ำ", "14": "เสียงที่ยังค้าง", "15": "ใจที่สวนกัน", "16": "เสียงสะท้อนเย็น",
    "17": "คำขอโทษที่กลืนไว้", "18": "โดยไม่เอ่ยคำ", "19": "ยิ่งใกล้ยิ่งถอย", "20": "โบยบิน",
    "21": "เปลวไฟครั้งที่สอง", "22": "ปลายวันอีกครั้ง", "23": "อยากสัมผัสเธอ", "24": "จุดไฟให้เธอ",
    "25": "บินสู่เช้า", "26": "บินสู่ท้องฟ้ายามค่ำ", "27": "บินครั้งสุดท้าย", "28": "พายุเปลวไฟ",
    "29": "สูงจนสุดฟ้า", "30": "คืนที่กลายเป็นดาว", "31": "วันที่รักซึมเข้ามา", "32": "แรงสั่นเล็กๆ",
    "33": "ลายของหัวใจ", "34": "เคียงข้างกัน", "35": "ยังคงอยู่", "36": "ที่ที่ยังเหลือ",
    "37": "ก้าวที่ช้า", "38": "ค่อยๆ เอนเข้า", "39": "หรือว่าเรา", "40": "แสงที่ยังค้าง",
}
GROOVY = {
    "01": "Soft Close", "02": "Soft Reach", "03": "Keep You Lit", "04": "Far As You",
    "05": "All the Hours", "06": "Still on Replay", "07": "Same Door", "08": "Cracked Days",
    "09": "Light Seat", "10": "Soul Loop", "11": "Low Talk", "12": "Deep End",
    "13": "Well Moon", "14": "Late Ring", "15": "Missed Signal", "16": "Cold Ring",
    "17": "Unsaid", "18": "No Goodbye", "19": "Too Close", "20": "Lift Off",
    "21": "Second Spark", "22": "Dusk Again", "23": "Hands Again", "24": "Hold the Lamp",
    "25": "Morning Wing", "26": "Night Wing", "27": "Last Wing", "28": "Storm Name",
    "29": "Above the Line", "30": "Star Exit", "31": "Soaked Day", "32": "Tiny Shake",
    "33": "Heart Grain", "34": "Two-Step", "35": "Stay Back", "36": "Left Seat",
    "37": "Slow Walk", "38": "Lean In", "39": "Could Be", "40": "Late Glow",
}
NARR = {
    "01": "Soft Hours", "02": "Soft Return", "03": "Pathlight", "04": "The Far Edge",
    "05": "Hours Beside You", "06": "What I Still Keep", "07": "The Door I Watch",
    "08": "After the Collapse", "09": "A Place for Light", "10": "Coming Back as Light",
    "11": "Words to No One", "12": "Under the Dark", "13": "The Moon I Let Go",
    "14": "What the Room Kept", "15": "When We Missed", "16": "A Cold Reply",
    "17": "Sorry, Left Inside", "18": "Leaving Quiet", "19": "Closer, Then Back",
    "20": "Learning to Rise", "21": "The Next Flame", "22": "Dusk, Once More",
    "23": "Wanting to Reach", "24": "Keeping a Lamp", "25": "The Morning Part",
    "26": "The Night Part", "27": "The Last Part", "28": "Named for Fire",
    "29": "Named for Height", "30": "Turning into Stars", "31": "Love, Soaking In",
    "32": "The Small Shiver", "33": "The Grain of It", "34": "Walking Level",
    "35": "Remaining", "36": "The Seat Left", "37": "Slower Than Before",
    "38": "A Lean, Not a Fall", "39": "A Late Maybe", "40": "Light After",
}
MOOD = {
    "01": ("조용한 끝에 남는 미소", "静かな終わりに残る微笑み", "a quiet smile at day's end", "รอยยิ้มที่ปลายวัน"),
    "02": ("네 빛에 숨이 다시 트임", "君の光で息が戻る", "breath coming back in your light", "ลมหายใจกลับมาในแสงเธอ"),
    "03": ("발끝에 꺼지지 않는 등불", "足元に消えない灯", "a lamp that stays at your feet", "โคมที่ไม่ดับที่ปลายเท้า"),
    "04": ("세상 끝에서도 놓치지 않음", "世界の果てでも離さない", "holding on at the world's end", "แม้สุดโลกก็ไม่ปล่อย"),
    "05": ("함께한 시간이 피어 남음", "一緒の時間が残る", "hours together still blooming", "เวลาที่อยู่ด้วยกันยังบาน"),
    "06": ("아직 그 밤을 기억함", "まだあの夜を覚えている", "still keeping that night", "ยังเก็บคืนนั้นไว้"),
    "07": ("문 앞에 남은 기다림", "扉の前に残る待ち", "waiting left at the door", "การรอที่ยังอยู่หน้าประตู"),
    "08": ("무너진 날에 남은 온기", "崩れた日に残る温もり", "warmth left in a fallen day", "ความอุ่นในวันที่พัง"),
    "09": ("빛이 머무는 빈자리", "光が止まる空席", "an empty seat where light stays", "ที่ว่างที่แสงยังอยู่"),
    "10": ("놓아준 마음이 다시 빛남", "手放した心がまた光る", "a released heart turning bright", "ใจที่ปล่อยแล้วกลับสว่าง"),
    "11": ("누구에게도 닿지 않은 말", "誰にも届かない言葉", "words that reach no one", "คำที่ไปไม่ถึงใคร"),
    "12": ("다시 사랑하지 않겠다는 밤", "もう愛さないと決めた夜", "a night of not loving again", "คืนที่ตั้งใจว่าจะไม่รักอีก"),
    "13": ("우물에 내려놓은 달", "井戸に置いた月", "a moon set down in the well", "จันทร์ที่วางไว้ในบ่อ"),
    "14": ("떠나보낸 뒤에 남은 울림", "送り出した後の残り音", "the ring after letting go", "เสียงที่เหลือหลังจากลา"),
    "15": ("진심이 서로 비껴간 밤", "真心がすれ違った夜", "a night our truths missed", "คืนที่ใจจริงสวนกัน"),
    "16": ("차갑게 돌아온 목소리", "冷たく返った声", "a voice that came back cold", "เสียงที่กลับมาอย่างเย็น"),
    "17": ("삼킨 미안이 아직 남음", "飲み込んだごめんが残る", "a sorry still held inside", "คำขอโทษที่ยังกลืนอยู่"),
    "18": ("말도 없이 닫힌 문", "言葉もなく閉まった扉", "a door shut without a word", "ประตูที่ปิดโดยไม่มีคำ"),
    "19": ("가까울수록 한 걸음 물러남", "近いほど一歩下がる", "one step back when you are near", "ยิ่งใกล้ยิ่งถอยก้าว"),
    "20": ("접었던 마음이 다시 펴짐", "たたんだ心がまた開く", "a folded heart opening again", "ใจที่พับไว้กำลังคลี่"),
    "21": ("두 번째 불꽃이 일어남", "二つ目の炎が立つ", "a second flame standing up", "เปลวที่สองลุกขึ้น"),
    "22": ("하루의 끝이 다시 열림", "一日の終わりがもう一度開く", "day's end opening again", "ปลายวันเปิดอีกครั้ง"),
    "23": ("다시 닿고 싶은 손", "もう一度触れたい手", "a hand wanting to reach again", "มือที่อยากแตะอีกครั้ง"),
    "24": ("너를 위해 켜 둔 불", "君のために点けた灯", "a light left on for you", "ไฟที่เปิดไว้เพื่อเธอ"),
    "25": ("아침을 향해 날아오름", "朝に向かって舞い上がる", "rising toward morning", "โบยบินเข้าหาเช้า"),
    "26": ("밤하늘을 가로질러 오름", "夜空を横切って上がる", "crossing the night as we rise", "ข้ามฟ้ายามค่ำขณะบิน"),
    "27": ("마지막 비행이 마침", "最後の飛行が閉じる", "the last flight closing", "เที่ยวบินสุดท้ายกำลังจบ"),
    "28": ("이름을 불꽃으로 부름", "名前を炎で呼ぶ", "calling a name in fire", "เรียกชื่อด้วยเปลวไฟ"),
    "29": ("더 높이 올라가는 숨", "もっと高く上がる息", "breath climbing higher", "ลมหายใจที่ปีนสูงขึ้น"),
    "30": ("한 생이 별이 되는 밤", "一生が星になる夜", "a life becoming stars", "ชีวิตทั้งคืนกลายเป็นดาว"),
    "31": ("사랑이 하루 속으로 스밈", "愛が一日に染みる", "love soaking into a day", "รักซึมเข้าไปในวัน"),
    "32": ("괜찮다는 말 뒤의 떨림", "大丈夫の後の震え", "a shiver after I'm fine", "แรงสั่นหลังคำว่าไม่เป็นไร"),
    "33": ("닫아 둔 마음에 스민 온기", "閉じた心に染みた温もり", "warmth in a closed heart", "ความอุ่นในใจที่ปิดไว้"),
    "34": ("서두르지 않고 나란히", "急がずに並んで", "side by side, not rushing", "เคียงกันโดยไม่เร่ง"),
    "35": ("네 시간까지 남아 있음", "君の時間まで残る", "staying until your time", "อยู่จนถึงเวลาของเธอ"),
    "36": ("지난 계절에 남은 나", "過ぎた季節に残る私", "the me left in a past season", "ตัวฉันที่ค้างในฤดูเก่า"),
    "37": ("커피 한 잔만큼 가까워짐", "コーヒー一杯ぶん近づく", "closer by one cup of coffee", "ใกล้ขึ้นเท่ากาแฟถ้วยหนึ่ง"),
    "38": ("말하지 못한 채 기울어짐", "言えないまま傾く", "leaning before I can say it", "เอนเข้าไปก่อนจะพูดได้"),
    "39": ("늦은 우리가 내일로 걸음", "遅い二人が明日へ歩く", "a late us walking toward tomorrow", "เราสายเดินไปหาพรุ่งนี้"),
    "40": ("새로운 빛에 번진 어제", "新しい光ににじむ昨日", "yesterday blooming in new light", "เมื่อวานที่บานในแสงใหม่"),
}

def hangul(s):
    return len(re.findall(r"[가-힣]", s or ""))
def kana(s):
    return len(re.findall(r"[\u3040-\u30ff\u4e00-\u9faf]", s or ""))
def thai(s):
    return len(re.findall(r"[\u0E00-\u0E7F]", s or ""))
def bare(s):
    s = re.sub(r"\[[^\]]*\]", " ", s or "")
    s = re.sub(r"\([^)]*\)", " ", s)
    return re.sub(r"\s+", "", s)

def load_orig():
    out = {}
    for p in glob.glob(ROOT + "/kpop-original/ep/*.json"):
        d = json.load(open(p, encoding="utf-8"))
        ep = str(d["ep"]).zfill(2)
        out[ep] = {
            "title": (d["pkg"].get("confirmedTitle") or d.get("title") or "").strip(),
            "bare": bare(d["pkg"].get("lyricsBlock") or ""),
        }
    return out

ORIG = load_orig()

def copied(ep, lyrics):
    src = ORIG.get(ep, {}).get("bare", "")
    made = bare(lyrics)
    return bool(src) and len(src) > 40 and made[:80] == src[:80]

def fit_yt(ep, title, mood, label):
    mood = re.sub(r"\s+", " ", mood).strip()
    while True:
        s = f"EP.{ep} | {title} | {mood} | {label} | AI Artist Noa" if mood else f"EP.{ep} | {title} | {label} | AI Artist Noa"
        if len(s) <= 100 and mood:
            return s
        if len(mood) > 4:
            mood = mood[:-1].rstrip()
            continue
        s = f"EP.{ep} | {title} | {label} | AI Artist Noa"
        return s if len(s) <= 100 else s[:100]

def block(sections):
    return "\n\n".join(f"[{name}]\n" + "\n".join(lines) for name, lines in sections)

def lyrics_for(gid, ep, title):
    ko, ja, en, th = MOOD[ep]
    if gid == "jpop-original":
        return block([
            ("Verse 1", [ja, "名前を呼ばなくても", "この夜は君のまま"]),
            ("Pre-Chorus", ["急がずに", "隣で息をする"]),
            ("Chorus", [title, ja, "もう一度、この気持ちだけ"]),
            ("Verse 2", ["窓の外は静かで", "胸の中だけが動いている", ja]),
            ("Chorus", [title, ja]),
        ])
    if gid == "thai-original":
        return block([
            ("Verse 1", [th, "ไม่ต้องเอ่ยชื่อก็ได้", "คืนนี้ยังเป็นเรื่องของเธอ"]),
            ("Pre-Chorus", ["ไม่เร่ง", "หายใจข้างกัน"]),
            ("Chorus", [title, th, "อีกครั้ง แค่ความรู้สึกนี้"]),
            ("Verse 2", ["นอกหน้าต่างเงียบ", "ในอกยังขยับ", th]),
            ("Chorus", [title, th]),
        ])
    if gid == "groovy-airy-pop":
        return block([
            ("Verse", [title, en, "short breath", "next word"]),
            ("Rap", [en, "say it late", "say it light", title]),
            ("Hook", [title, en]),
            ("Verse 2", [en, "the room stays small", "the feeling doesn't"]),
            ("Hook", [title, en]),
        ])
    if gid == "narrative-piano-indie":
        return block([
            ("Verse 1", [f"The hour is called {title}.", en, "The room is ordinary. The feeling is not."]),
            ("Chorus", [title, en, "I say it slower than the first time."]),
            ("Verse 2", ["What stayed in the cup is still warm.", en]),
            ("Chorus", [title, en]),
        ])
    if gid == "pop-original":
        return block([
            ("Verse 1", [en, "I don't rush the name", title]),
            ("Pre-Chorus", ["Stay near", "Breathe with me"]),
            ("Chorus", [title, en, "Once more, only this feeling"]),
            ("Verse 2", ["Outside, the window is quiet", "Inside, it still moves", en]),
            ("Chorus", [title, en]),
        ])
    if gid == "edm-kpop-club":
        token = re.sub(r"[^A-Za-z0-9 ]", "", en).upper()[:28] or "THIS SONG"
        return block([
            ("Intro", [token, "RESET NOW"]),
            ("Drop", [token, token]),
            ("Chant", [token, "HANDS UP"]),
            ("Break", [token, "STAY ON THIS ONE"]),
            ("Final Drop", [token, "RESET COMPLETE"]),
        ])
    if gid == "fantasy-ambient-edm":
        seed = " ".join(w[:4] for w in re.sub(r"[^a-z ]", "", en.lower()).split()) or "luma"
        return block([
            ("Verse", [f"luma {seed}", "ora ven"]),
            ("Lift", ["sha ven ora", seed]),
            ("Wave", [f"ora {seed}", "ven luma"]),
            ("Verse 2", [seed, "luma sha"]),
            ("Wave", [f"luma {seed}"]),
        ])
    if gid == "joseon-ballad":
        return block([
            ("Verse 1", [ko, "이 밤의 정은 낮은 숨으로 고입니다", title]),
            ("Pre-Chorus", ["서두르지 않으리", "임의 걸음만 따릅니다"]),
            ("Chorus", [title, ko, "오늘 이 마음만 부릅니다"]),
            ("Verse 2", ["창밖은 고요하고", "가슴만 아직 움직입니다", ko]),
            ("Chorus", [title, ko]),
        ])
    if gid == "panpop":
        return block([
            ("Verse 1", [ko, "숨만 다시 고르고", title]),
            ("Pre-Chorus", ["여기, 이 마음", "서두르지 않아"]),
            ("Chorus", [title, ko, "I'll keep this one"]),
            ("Bass Drop", [title, title]),
            ("Verse 2", ["같은 밤을 다른 결로", ko]),
            ("Chorus", [title, ko]),
        ])
    if gid == "echoes-of-joseon":
        return block([
            ("Verse 1", [ko, title]),
            ("Build", [en, "same night, new mouth"]),
            ("Chorus", [title, ko, en]),
            ("Rap", [en, title, "say it once, then hit"]),
            ("Drop", [title, ko]),
        ])
    if gid == "dreamy-deep-house":
        return block([
            ("Verse 1", [ko, "작은 방, 낮은 목소리", title]),
            ("Break", ["breathe slow", ko]),
            ("Chorus", [title, ko, "stay close"]),
            ("Verse 2", ["창은 조용하고", "이 잔향만 남겨", ko]),
            ("Chorus", [title, "soft hold"]),
        ])
    if gid == "latin-afrobeats-edm":
        return block([
            ("Verse 1", [ko, title, "brighter, same story"]),
            ("Pre-Chorus", [en, ko]),
            ("Chorus", [title, ko, en]),
            ("Verse 2", ["이 리듬 안에", ko]),
            ("Chorus", [title, en]),
        ])
    return block([
        ("Verse 1", [ko, title]),
        ("Chorus", [title, ko]),
        ("Verse 2", [ko]),
        ("Chorus", [title, ko]),
    ])

def needs_lyrics(gid, ep, text):
    if gid == "kpop-original":
        return False
    if copied(ep, text):
        return True
    if gid == "jpop-original" and kana(text) < 8 and hangul(text) > 20:
        return True
    if gid == "thai-original" and thai(text) < 8 and hangul(text) > 20:
        return True
    if gid in ("pop-original", "groovy-airy-pop", "narrative-piano-indie") and hangul(text) > 40:
        return True
    return False

def target_title(gid, ep, title, src):
    if gid not in REWRITE:
        return ""
    if gid == "joseon-ballad":
        return ""  # already 한글(한문) titles stay; ledger owns these
    if gid == "jpop-original":
        if kana(title) >= 2 and title != src and "板" not in title:
            return ""
        return JA[ep]
    if gid == "thai-original":
        if thai(title) >= 2 and title != src:
            return ""
        return TH[ep]
    if gid == "pop-original":
        if hangul(title) == 0 and title != "하루의 끝에":
            return ""
        return EN[ep]
    if gid == "groovy-airy-pop":
        if hangul(title) == 0 and title != src:
            return ""
        return GROOVY[ep]
    if gid == "narrative-piano-indie":
        if hangul(title) == 0 and title != src:
            return ""
        return NARR[ep]
    return ""

def mood_of(gid, ep):
    ko, ja, en, th = MOOD[ep]
    if gid == "jpop-original":
        return ja
    if gid == "thai-original":
        return th
    if gid in ("pop-original", "groovy-airy-pop", "narrative-piano-indie", "fantasy-ambient-edm"):
        return en
    return ko

def main():
    stats = {"title": 0, "yt": 0, "lyrics": 0, "files": 0}
    for path in glob.glob(ROOT + "/*/ep/*.json"):
        d = json.load(open(path, encoding="utf-8"))
        gid = d["genreId"]
        ep = str(d["ep"]).zfill(2)
        if f"{gid}:ep:{ep}" in FLAGS or gid == "kpop-original":
            continue
        pkg = d["pkg"]
        src = ORIG.get(ep, {}).get("title", "")
        title = (pkg.get("confirmedTitle") or "").strip()
        changed = False
        new_title = target_title(gid, ep, title, src)
        if new_title and new_title != title:
            pkg["confirmedTitle"] = new_title
            d["title"] = new_title
            title = new_title
            stats["title"] += 1
            changed = True
        if gid in KO_GENRES and src and not title:
            pkg["confirmedTitle"] = src
            title = src
            changed = True
        mood = mood_of(gid, ep)
        label = LABEL.get(gid, gid)
        yt = pkg.get("youtubeTitle") or ""
        parts = [p.strip() for p in yt.split("|")]
        mood_missing = len(parts) < 5 or title not in yt
        if title and (mood_missing or title not in yt):
            pkg["youtubeTitle"] = fit_yt(ep, title, mood, label)
            stats["yt"] += 1
            changed = True
        ly = pkg.get("lyricsBlock") or ""
        if needs_lyrics(gid, ep, ly):
            pkg["lyricsBlock"] = lyrics_for(gid, ep, title or src)
            stats["lyrics"] += 1
            changed = True
        if changed:
            stats["files"] += 1
            with open(path, "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, separators=(",", ":"))
                f.write("\n")
    print(stats)

if __name__ == "__main__":
    main()
