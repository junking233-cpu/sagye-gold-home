// ================================================
// 사계절 금거래소 - 카카오 챗봇 가격 API
// ================================================
// 이 API는 카카오 오픈빌더 "스킬"에서 호출됩니다.
//
// 엔드포인트:
//   GET  https://sagye-gold-home.vercel.app/api/prices
//   POST https://sagye-gold-home.vercel.app/api/prices (카카오 챗봇용)
//
// 작동 방식:
//   1. GitHub Pages에서 prices.json 읽어옴
//   2. 카카오 챗봇 형식의 응답으로 변환
//   3. 챗봇이 사용자에게 시세표 표시
// ================================================

export default async function handler(req, res) {
  // CORS 허용 (카카오에서 호출 가능하도록)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ── prices.json 가져오기 ─────────────────────
    const pricesUrl = 'https://www.sagyegold.co.kr/prices.json';
    const response = await fetch(pricesUrl, {
      cache: 'no-store' // 항상 최신 가격
    });

    if (!response.ok) {
      throw new Error('가격 정보를 불러올 수 없습니다');
    }

    const prices = await response.json();

    // ── 숫자를 "860,000원" 형식으로 ─────────────────
    const fmt = (n) => {
      if (typeof n === 'string') return n;
      return n.toLocaleString('ko-KR') + '원';
    };

    // ── 쿼리 파라미터로 어떤 응답 줄지 결정 ──────────
    // 카카오 챗봇에서: ?type=buying / ?type=selling / ?type=all
    const type = req.query.type || req.body?.action?.params?.type || 'all';

    // ================================================
    // 응답 1: 매입가 (손님이 팔때)
    // ================================================
    if (type === 'buying') {
      const buyingText =
        `💰 오늘의 매입 시세\n` +
        `(${prices.updated} 기준 · 1돈 / g당)\n` +
        `━━━━━━━━━━━━━━\n\n` +
        `🟡 골드바\n` +
        `  ${fmt(prices.buying.골드바)}\n\n` +
        `🔶 덩이금 등급별\n` +
        `  검증 3대마크: ${fmt(prices.buying.검증3대마크)}\n` +
        `  검증 덩이: ${fmt(prices.buying.검증덩이)}\n` +
        `  기타 덩이: ${fmt(prices.buying.기타덩이)}\n` +
        `  무검 덩이: ${fmt(prices.buying.무검덩이)}\n` +
        `  칠보·마고자: ${fmt(prices.buying.칠보마고자등)}\n\n` +
        `💍 검인 상품 (1돈)\n` +
        `  반지·메달: ${fmt(prices.buying.검인반지메달)}\n` +
        `  목걸이·팔찌: ${fmt(prices.buying.검인목걸이팔찌)}\n\n` +
        `🔑 특수 상품\n` +
        `  열쇠: ${fmt(prices.special_buying.열쇠)} (천원/돈)\n` +
        `  상패·동물·골프공: ${fmt(prices.special_buying.상패동물골프공)} (천원/돈)\n\n` +
        `✨ K 쥬얼리 (1돈)\n` +
        `  18K: ${fmt(prices.buying.K18)}\n` +
        `  14K: ${fmt(prices.buying.K14)}\n` +
        `  10K: ${fmt(prices.buying.K10)}\n` +
        `  치금: ${fmt(prices.special_buying.치금)} (천원/g)\n\n` +
        `⚪ 기타\n` +
        `  백금: ${fmt(prices.buying.백금)}\n` +
        `  실버바(1kg): ${fmt(prices.buying.실버바_1kg)}\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `※ 실제 매입가는 감정 후 결정됩니다.\n` +
        `📞 상담: 010-8949-9683`;

      return res.status(200).json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: buyingText
              }
            }
          ]
        }
      });
    }

    // ================================================
    // 응답 2: 판매가 (손님이 살때)
    // ================================================
    if (type === 'selling') {
      const sellingText =
        `🏆 오늘의 판매 시세\n` +
        `(${prices.updated} 기준)\n` +
        `━━━━━━━━━━━━━━\n\n` +
        `🟡 골드바\n` +
        `  1돈: ${fmt(prices.selling.골드바_1돈)}\n` +
        `  3돈: ${fmt(prices.selling.골드바_3돈)}\n` +
        `  5돈: ${fmt(prices.selling.골드바_5돈)}\n` +
        `  10돈: ${fmt(prices.selling.골드바_10돈)}\n\n` +
        `🔶 덩이금\n` +
        `  1돈: ${fmt(prices.selling.덩이금_1돈)}\n` +
        `  3돈: ${fmt(prices.selling.덩이금_3돈)}\n` +
        `  5돈: ${fmt(prices.selling.덩이금_5돈)}\n` +
        `  10돈: ${fmt(prices.selling.덩이금_10돈)}\n\n` +
        `💍 돌반지 (1돈)\n` +
        `  조각: ${fmt(prices.selling.돌반지_조각)}\n` +
        `  캐릭터: ${fmt(prices.selling.돌반지_캐릭터)}\n` +
        `  동물: ${fmt(prices.selling.돌반지_동물)}\n` +
        `  크라운: ${fmt(prices.selling.돌반지_크라운)}\n\n` +
        `🌾 쌀알금 (1g)\n` +
        `  기본: ${fmt(prices.selling.쌀알금_1g)}\n` +
        `  모양: ${fmt(prices.selling.모양쌀알금_1g)}\n\n` +
        `🥄 금수저\n` +
        `  1돈: ${fmt(prices.selling.금수저_1돈)}\n` +
        `  3돈: ${fmt(prices.selling.금수저_3돈)}\n\n` +
        `🔑 열쇠\n` +
        `  1돈: ${fmt(prices.selling.열쇠_1돈)}\n` +
        `  3돈: ${fmt(prices.selling.열쇠_3돈)}\n\n` +
        `⚪ 실버바 (1kg)\n` +
        `  99.9: ${fmt(prices.selling.실버바_999)}\n` +
        `  999.9: ${fmt(prices.selling.실버바_9999)}\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `※ 밀당없는 정찰제\n` +
        `📞 상담: 010-8949-9683`;

      return res.status(200).json({
        version: '2.0',
        template: {
          outputs: [
            {
              simpleText: {
                text: sellingText
              }
            }
          ]
        }
      });
    }

    // ================================================
    // 응답 3: 기본(전체) - type 없거나 all일 때
    // ================================================
    const mainText =
      `🍀 사계절 금거래소 시세\n` +
      `(${prices.updated} 기준)\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `[ 골드바 1돈 ]\n` +
      `  매입: ${fmt(prices.base.골드바_팔때)}\n` +
      `  판매: ${fmt(prices.base.골드바_살때)}\n\n` +
      `[ K 쥬얼리 매입 (1돈) ]\n` +
      `  18K: ${fmt(prices.base.K18)}\n` +
      `  14K: ${fmt(prices.base.K14)}\n` +
      `  10K: ${fmt(prices.base.K10)}\n\n` +
      `[ 실버바 1kg ]\n` +
      `  매입: ${fmt(prices.base.실버바_팔때)}\n` +
      `  판매: ${fmt(prices.base.실버바_살때)}\n\n` +
      `━━━━━━━━━━━━━━\n` +
      `📞 010-8949-9683\n` +
      `🌐 www.sagyegold.co.kr`;

    return res.status(200).json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text: mainText
            }
          }
        ]
      }
    });

  } catch (error) {
    // ── 에러 처리 ─────────────────────────────────
    console.error('API 에러:', error);
    return res.status(200).json({
      version: '2.0',
      template: {
        outputs: [
          {
            simpleText: {
              text:
                '⚠️ 시세 정보를 불러오는데 문제가 있어요.\n\n' +
                '📞 매장으로 전화 주시면 친절하게 안내해드립니다.\n' +
                '010-8949-9683'
            }
          }
        ]
      }
    });
  }
}
