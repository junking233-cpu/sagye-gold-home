"""
사계절 금거래소 - 가격 카드 생성 + 텔레그램 전송

홈페이지 https://www.sagyegold.co.kr/prices.json 을 읽어서 카드 이미지를 만들고, 텔레그램 봇으로 전송합니다.
(prices.json 은 Vercel 함수가 장부 「손님 시세」 사계절 탭 값으로 만듭니다 — 저장소에는 prices.js · prices.json 이 없습니다)

GitHub Actions 「텔레그램 가격 알림」 을 손으로 돌릴 때만 실행됩니다 (workflow_dispatch).
평소 가격이 바뀌면 장부가 그 매장 텔레그램 알림 방에 한 줄을 보냅니다.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


# ──────────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────────
ROOT = Path(__file__).parent

# 가격은 홈페이지에서 읽습니다 (장부 값 · 저장소 파일 아님). 시험할 때만 PRICES_URL 로 바꿀 수 있습니다.
PRICES_URL = os.environ.get("PRICES_URL") or "https://www.sagyegold.co.kr/prices.json"
BG_IMAGE = ROOT / "store-bg.png"
OUTPUT_CARD = ROOT / "today_card.png"

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
FONT_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

W, H = 1080, 1080
NAVY_DARK = "#0d1420"
NAVY_LIGHT = "#2a3852"
GOLD = "#c9a55a"
GOLD_BRIGHT = "#e0c074"
CREAM = "#f5ebd9"


# ──────────────────────────────────────────────────
# 홈페이지 prices.json 에서 가격 읽기 (장부 「손님 시세」 사계절 탭 값)
# ──────────────────────────────────────────────────
CARD_KEYS = ["골드바_살때", "골드바_팔때", "K18", "K14", "백금", "실버바_살때", "실버바_팔때"]


def fetch_prices():
    """prices.json 의 base 에서 카드에 쓰는 7칸을 읽음 → (가격, updated, X-Rates-Source)"""
    req = urllib.request.Request(
        PRICES_URL,
        headers={"User-Agent": "sagye-telegram-card", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        source = response.headers.get("X-Rates-Source") or "?"
        data = json.loads(response.read().decode("utf-8"))

    base = data.get("base") or {}
    prices = {}
    for key in CARD_KEYS:
        value = base.get(key)
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise ValueError(f"prices.json base 에 {key} 숫자가 없음: {value!r}")
        prices[key] = value
    return prices, data.get("updated"), source


def date_from_updated(updated):
    """prices.json updated 'YYYY-MM-DD' (장부 저장 날짜) → '2026년 11월 2일' · 못 읽으면 None"""
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", str(updated or ""))
    if not m:
        return None
    return f"{int(m.group(1))}년 {int(m.group(2))}월 {int(m.group(3))}일"


# ──────────────────────────────────────────────────
# 유틸
# ──────────────────────────────────────────────────
def font(path, size):
    return ImageFont.truetype(path, size)


def won(n):
    return f"{n:,}원"


def get_kst_today():
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    return f"{now.year}년 {now.month}월 {now.day}일"


def get_kst_time():
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    hour = now.hour
    if hour < 12:
        ampm = "오전"
        h12 = hour if hour != 0 else 12
    else:
        ampm = "오후"
        h12 = hour - 12 if hour > 12 else 12
    return f"{ampm} {h12}:{now.minute:02d}"


# ──────────────────────────────────────────────────
# 카드 이미지 생성
# ──────────────────────────────────────────────────
def make_card(prices, date_str, time_str):
    items = [
        ("골드바 1돈",   won(prices["골드바_살때"]),  won(prices["골드바_팔때"])),
        ("18K",         "제품시세적용",                won(prices["K18"])),
        ("14K",         "제품시세적용",                won(prices["K14"])),
        ("백금",         "제품시세적용",                won(prices["백금"])),
        ("실버바 1kg",   won(prices["실버바_살때"]),   won(prices["실버바_팔때"])),
    ]

    bg = Image.open(BG_IMAGE).convert("RGB")
    bg = bg.resize((W, H))
    overlay = Image.new("RGB", (W, H), NAVY_DARK)
    bg = Image.blend(bg, overlay, alpha=0.65)
    bg = bg.filter(ImageFilter.GaussianBlur(radius=2))
    img = bg
    d = ImageDraw.Draw(img)

    d.rectangle([(45, 45), (W-45, H-45)], outline=GOLD, width=2)
    d.text((W//2, 145), "사계절 금거래소", font=font(FONT_SERIF, 60),
           fill=GOLD_BRIGHT, anchor="mm")
    d.text((W//2, 200), "F O U R   S E A S O N S   G O L D",
           font=font(FONT_REG, 18), fill="#a89070", anchor="mm")
    d.text((W//2, 275), date_str, font=font(FONT_BOLD, 30),
           fill=CREAM, anchor="mm")
    d.line([(330, 320), (W-330, 320)], fill=GOLD, width=1)
    d.text((W//2, 320), "  ◆  ", font=font(FONT_BOLD, 18),
           fill=GOLD, anchor="mm")
    d.text((155, 385), "품목", font=font(FONT_BOLD, 26), fill="#a89070", anchor="lm")
    d.text((615, 385), "내가 살 때", font=font(FONT_BOLD, 26), fill=GOLD_BRIGHT, anchor="mm")
    d.text((900, 385), "내가 팔 때", font=font(FONT_BOLD, 26), fill="#a89070", anchor="mm")
    d.line([(140, 420), (W-140, 420)], fill=NAVY_LIGHT, width=1)

    y = 475
    for item, buy, sell in items:
        d.text((155, y), item, font=font(FONT_BOLD, 32), fill=CREAM, anchor="lm")
        if "원" in buy:
            d.text((615, y), buy, font=font(FONT_BOLD, 30),
                   fill=GOLD_BRIGHT, anchor="mm")
        else:
            d.text((615, y), buy, font=font(FONT_REG, 22),
                   fill="#8a7a68", anchor="mm")
        d.text((900, y), sell, font=font(FONT_BOLD, 30),
               fill=CREAM, anchor="mm")
        y += 88

    d.line([(330, 920), (W-330, 920)], fill=NAVY_LIGHT, width=1)
    d.text((W//2, 955), "※ 시세는 실시간으로 변동됩니다",
           font=font(FONT_BOLD, 24), fill=CREAM, anchor="mm")
    d.text((W//2, 1000), "전화 010-8949-9681",
           font=font(FONT_BOLD, 26), fill=GOLD_BRIGHT, anchor="mm")
    d.text((W//2, 1045), "www.sagyegold.co.kr",
           font=font(FONT_BOLD, 24), fill=GOLD_BRIGHT, anchor="mm")

    d.text((W-65, H-65), time_str, font=font(FONT_BOLD, 20),
           fill=GOLD_BRIGHT, anchor="rm")

    img.save(OUTPUT_CARD)
    print(f"✅ 카드 이미지 생성 완료: {OUTPUT_CARD}")


# ──────────────────────────────────────────────────
# 캡션
# ──────────────────────────────────────────────────
def make_caption(prices, date_str):
    return f"""🍀 사계절 금거래소 시세 안내
{date_str} 기준

━━━━━━━━━━━
📌 오늘의 가격

🟡 골드바 1돈
   살 때 {won(prices['골드바_살때'])} / 팔 때 {won(prices['골드바_팔때'])}

💍 18K {won(prices['K18'])}
💍 14K {won(prices['K14'])}
⚪ 백금 {won(prices['백금'])}

🥈 실버바 1kg
   살 때 {won(prices['실버바_살때'])} / 팔 때 {won(prices['실버바_팔때'])}
━━━━━━━━━━━

※ 시세는 실시간으로 변동됩니다
📞 010-8949-9681
🌐 www.sagyegold.co.kr
📍 인천 서구 가정로 451

#사계절금거래소 #금시세 #금값 #금거래소 #인천금은방 #서구금은방 #가정동금은방 #골드바 #18K #14K #백금 #실버바"""


# ──────────────────────────────────────────────────
# 텔레그램 전송
# ──────────────────────────────────────────────────
def send_telegram(image_path, caption):
    if not BOT_TOKEN or not CHAT_ID:
        print("❌ 텔레그램 토큰/Chat ID 미설정")
        sys.exit(1)

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    boundary = "----SagyeBoundary"
    body = []

    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="chat_id"')
    body.append(b"")
    body.append(str(CHAT_ID).encode())

    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="caption"')
    body.append(b"")
    body.append(caption.encode("utf-8"))

    with open(image_path, "rb") as f:
        photo_data = f.read()

    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="photo"; filename="card.png"')
    body.append(b"Content-Type: image/png")
    body.append(b"")
    body.append(photo_data)
    body.append(f"--{boundary}--".encode())

    body_bytes = b"\r\n".join(body)

    req = urllib.request.Request(
        url, data=body_bytes,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            if result.get("ok"):
                print("✅ 텔레그램 전송 성공!")
            else:
                print(f"❌ 전송 실패: {result}")
                sys.exit(1)
    except Exception as e:
        print(f"❌ 전송 에러: {e}")
        sys.exit(1)


# ──────────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────────
def main():
    print("🍀 사계절 금거래소 - 텔레그램 알림 시작")

    # 홈페이지 prices.json 에서 가격 읽기 (장부 값)
    prices, updated, source = fetch_prices()
    print(f"💰 {PRICES_URL} 에서 읽음 (X-Rates-Source: {source} · updated: {updated})")
    for k, v in prices.items():
        print(f"   {k}: {v:,}")

    if source == "fallback":
        # 장부를 못 읽어 예비 값(옛 숫자)이 나가는 중 — 옛 숫자로 카드를 보내지 않음
        print("❌ 홈페이지가 예비 값을 내고 있습니다 (장부를 못 읽음) — 카드를 보내지 않습니다")
        sys.exit(1)
    if source not in ("ledger", "memory"):
        print("⚠️ X-Rates-Source 머리글이 없습니다 — 저장소에 prices.json 정적 파일이 다시 생긴 건 아닌지 보세요")

    # 카드 날짜 = 장부 저장 날짜 (못 읽으면 오늘)
    date_str = date_from_updated(updated) or get_kst_today()
    time_str = get_kst_time()
    print(f"📅 {date_str} {time_str}")

    make_card(prices, date_str, time_str)
    caption = make_caption(prices, date_str)
    send_telegram(OUTPUT_CARD, caption)

    print("✅ 모든 작업 완료!")


if __name__ == "__main__":
    main()
