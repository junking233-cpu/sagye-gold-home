"""
사계절 금거래소 - 가격 카드 생성 + 텔레그램 전송

prices.json을 읽어서 카드 이미지를 만들고, 텔레그램 봇으로 전송합니다.
GitHub Actions에서 자동 실행됩니다.
"""

import json
import os
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter


# ──────────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────────
ROOT = Path(__file__).parent

PRICES_JSON = ROOT / "prices.json"
BG_IMAGE = ROOT / "store-bg.png"
OUTPUT_CARD = ROOT / "today_card.png"

# 텔레그램 토큰 / Chat ID는 환경변수에서 (GitHub Secrets)
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID")

# 폰트 (Ubuntu 환경 - GitHub Actions)
FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
FONT_BLACK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
FONT_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc"

# 디자인 컬러
W, H = 1080, 1080
NAVY_DARK = "#0d1420"
NAVY_LIGHT = "#2a3852"
GOLD = "#c9a55a"
GOLD_BRIGHT = "#e0c074"
CREAM = "#f5ebd9"


# ──────────────────────────────────────────────────
# 유틸
# ──────────────────────────────────────────────────
def font(path, size):
    return ImageFont.truetype(path, size)


def won(n):
    return f"{n:,}원"


def get_kst_today():
    """한국 시간 기준 오늘 날짜"""
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst)
    return f"{now.year}년 {now.month}월 {now.day}일"


def get_kst_time():
    """한국 시간 기준 현재 시각 (오전/오후 HH:MM)"""
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
def make_card(prices_data, date_str, time_str):
    """가격 카드 이미지 생성"""

    base = prices_data["base"]

    # 카드에 표시할 5개 항목
    items = [
        ("골드바 1돈",   won(base["골드바_살때"]),  won(base["골드바_팔때"])),
        ("18K",         "제품시세적용",              won(base["K18"])),
        ("14K",         "제품시세적용",              won(base["K14"])),
        ("백금",         "제품시세적용",              won(base["백금"])),
        ("실버바 1kg",   won(base["실버바_살때"]),   won(base["실버바_팔때"])),
    ]

    # 배경: 매장 사진 → 어둡게 + 블러
    bg = Image.open(BG_IMAGE).convert("RGB")
    bg = bg.resize((W, H))
    overlay = Image.new("RGB", (W, H), NAVY_DARK)
    bg = Image.blend(bg, overlay, alpha=0.65)
    bg = bg.filter(ImageFilter.GaussianBlur(radius=2))

    img = bg
    d = ImageDraw.Draw(img)

    # 골드 외곽 라인
    d.rectangle([(45, 45), (W-45, H-45)], outline=GOLD, width=2)

    # 매장명
    d.text((W//2, 145), "사계절 금거래소", font=font(FONT_SERIF, 60),
           fill=GOLD_BRIGHT, anchor="mm")
    d.text((W//2, 200), "F O U R   S E A S O N S   G O L D",
           font=font(FONT_REG, 18), fill="#a89070", anchor="mm")

    # 날짜
    d.text((W//2, 275), date_str, font=font(FONT_BOLD, 30),
           fill=CREAM, anchor="mm")

    # 장식
    d.line([(330, 320), (W-330, 320)], fill=GOLD, width=1)
    d.text((W//2, 320), "  ◆  ", font=font(FONT_BOLD, 18),
           fill=GOLD, anchor="mm")

    # 헤더
    d.text((155, 385), "품목", font=font(FONT_BOLD, 26), fill="#a89070", anchor="lm")
    d.text((615, 385), "내가 살 때", font=font(FONT_BOLD, 26), fill=GOLD_BRIGHT, anchor="mm")
    d.text((900, 385), "내가 팔 때", font=font(FONT_BOLD, 26), fill="#a89070", anchor="mm")

    d.line([(140, 420), (W-140, 420)], fill=NAVY_LIGHT, width=1)

    # 가격 행
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

    # 하단
    d.line([(330, 920), (W-330, 920)], fill=NAVY_LIGHT, width=1)
    d.text((W//2, 955), "※ 시세는 실시간으로 변동됩니다",
           font=font(FONT_BOLD, 24), fill=CREAM, anchor="mm")
    d.text((W//2, 1000), "전화 010-8949-9681",
           font=font(FONT_BOLD, 26), fill=GOLD_BRIGHT, anchor="mm")
    d.text((W//2, 1045), "www.sagyegold.co.kr",
           font=font(FONT_BOLD, 24), fill=GOLD_BRIGHT, anchor="mm")

    # 우측 하단 모서리에 작게 업데이트 시간 (오전/오후 + 시:분)
    d.text((W-65, H-65), time_str, font=font(FONT_BOLD, 20),
           fill=GOLD_BRIGHT, anchor="rm")

    img.save(OUTPUT_CARD)
    print(f"✅ 카드 이미지 생성 완료: {OUTPUT_CARD}")


# ──────────────────────────────────────────────────
# 캡션 텍스트 생성 (인스타/카카오에 같이 올릴 글)
# ──────────────────────────────────────────────────
def make_caption(prices_data, date_str):
    """SNS용 캡션 텍스트"""
    base = prices_data["base"]

    caption = f"""🍀 사계절 금거래소 시세 안내
{date_str} 기준

━━━━━━━━━━━
📌 오늘의 가격

🟡 골드바 1돈
   살 때 {won(base['골드바_살때'])} / 팔 때 {won(base['골드바_팔때'])}

💍 18K {won(base['K18'])}
💍 14K {won(base['K14'])}
⚪ 백금 {won(base['백금'])}

🥈 실버바 1kg
   살 때 {won(base['실버바_살때'])} / 팔 때 {won(base['실버바_팔때'])}
━━━━━━━━━━━

※ 시세는 실시간으로 변동됩니다
📞 010-8949-9681
🌐 www.sagyegold.co.kr
📍 인천 서구 가정로 451

#사계절금거래소 #금시세 #금값 #금거래소 #인천금은방 #서구금은방 #가정동금은방 #골드바 #18K #14K #백금 #실버바"""

    return caption


# ──────────────────────────────────────────────────
# 텔레그램 전송
# ──────────────────────────────────────────────────
def send_telegram(image_path, caption):
    """텔레그램 봇으로 사진 + 캡션 전송"""
    if not BOT_TOKEN or not CHAT_ID:
        print("❌ 텔레그램 토큰/Chat ID가 설정되지 않았습니다")
        sys.exit(1)

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"

    # multipart/form-data 직접 구성
    boundary = "----SagyeBoundary"
    body = []

    # chat_id
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="chat_id"')
    body.append(b"")
    body.append(str(CHAT_ID).encode())

    # caption
    body.append(f"--{boundary}".encode())
    body.append(b'Content-Disposition: form-data; name="caption"')
    body.append(b"")
    body.append(caption.encode("utf-8"))

    # photo
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
        url,
        data=body_bytes,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )

    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            if result.get("ok"):
                print(f"✅ 텔레그램 전송 성공!")
            else:
                print(f"❌ 텔레그램 전송 실패: {result}")
                sys.exit(1)
    except Exception as e:
        print(f"❌ 텔레그램 전송 에러: {e}")
        sys.exit(1)


# ──────────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────────
def main():
    print("🍀 사계절 금거래소 - 텔레그램 알림 시작")

    # prices.json 읽기
    with open(PRICES_JSON, "r", encoding="utf-8") as f:
        prices_data = json.load(f)

    print(f"📅 prices.json 업데이트 날짜: {prices_data.get('updated')}")

    date_str = get_kst_today()
    time_str = get_kst_time()
    print(f"📅 오늘 날짜 (KST): {date_str} {time_str}")

    # 카드 이미지 생성
    make_card(prices_data, date_str, time_str)

    # 캡션 만들기
    caption = make_caption(prices_data, date_str)

    # 텔레그램 전송
    send_telegram(OUTPUT_CARD, caption)

    print("✅ 모든 작업 완료!")


if __name__ == "__main__":
    main()
