# 채다 공개 웹 유입 측정·검색 점검

작성일: 2026-10-22

## 현재 구현과 한계

- 홈의 소개·스토어 링크·가이드 링크·안내를 일반 HTML로 제공한다. JavaScript가 꺼져도 읽을 수 있다.
- `content.js`를 공통 문구 정본으로 유지하고 정적 홈 HTML은 아래 명령으로 갱신한다. 실행 시 같은 ID를 교체하므로 소개가 두 번 나타나지 않는다.
- 새 가이드 `/guides/coupon-vs-yield/`를 홈·공통 메뉴·사이트맵에 연결한다.
- `acquisition.js`는 캠페인 출처를 구분하고 이벤트를 **현재 페이지의 메모리에만 최대 50건** 남긴다. 쿠키·localStorage·sessionStorage·사용자 식별자는 사용하지 않는다.
- 기존 Chaeda PostHog 프로젝트로 보내는 수동 전송기 `posthog-acquisition.js`를 준비했다. 공개 프로젝트 설정은 `acquisition-config.js`에서 읽는다. **현재 `enabled: false`로 공개 수집은 꺼져 있다.** 고지 검토와 배포·활성화 판단을 마친 뒤 실제 방문 이벤트 수신을 별도 확인해야 한다.
- 전송기는 HTTPS의 `chaeda.kr`·`www.chaeda.kr`에서만 활성화될 수 있고 localhost·미리보기에서는 자동 비활성화한다. DNT 또는 GPC 거부 신호가 있으면 보내지 않는다.
- 페이지마다 새 임의 ID를 메모리에만 만들고 같은 페이지 안에서만 사용한다. 이전 페이지·재방문·앱 회원과 연결하지 않는다. SDK·자동 수집·세션 리플레이·브라우저 지속 저장은 사용하지 않는다.
- 웹 방문·체험 버튼 클릭·스토어 이동은 실제 설치, 회원가입, 앱 첫 검색·보유 등록을 증명하지 않는다. 앱 이벤트와 개인 단위로 자동 연결하지 않는다.

## 콘텐츠 갱신과 검증

`public_web/`에서 실행한다.

```sh
node acquisition/render-static-home.cjs
node acquisition/render-static-home.cjs --check
node --test acquisition.test.js
node --test posthog-acquisition.test.js
node --test legacy-guide-acquisition.test.js
```

첫 명령은 `content.js`를 읽어 `index.html`의 `static:*` 블록만 갱신한다. 콘텐츠 정본 변경 후 정적 HTML을 함께 갱신하고 두 파일을 함께 검토한다.

홈과 가이드의 문서 끝에서 `acquisition.js → acquisition-config.js → posthog-acquisition.js`를 일반 script로 순서대로 불러온다. 세 파일에 `defer`·`async`를 섞으면 첫 페이지 이벤트 전에 adapter가 준비되지 않을 수 있다. 실제 HTML의 속성과 파서 시점을 재현하는 통합 테스트로 이 순서를 확인한다.

기존 수익구조 가이드는 `bond-yield-site.dc.html`에서 재생성된 사본으로 표시되어 있으며, 현재 workspace와 Git 추적 파일에서 상위 원본을 찾지 못했다. 사본 본문을 직접 수정하지 않고 공용 원본 `app.js`에서 해당 가이드의 정확한 두 경로만 보강한다. `document.currentScript.src`와 같은 출처의 세 유입 스크립트를 차례로 불러오고 `CHAEDA_ACQUISITION_MANUAL_START`로 첫 이벤트를 보류한 뒤 전송기 준비 후 한 번 초기화한다. 오류가 나면 가이드 읽기는 유지하고 가능한 로컬 출처 연결만 초기화한다. 본문 재생성이나 배포 사본 패치는 추가하지 않았다.

## 배포 후 확인할 검색 항목

1. `https://chaeda.kr/robots.txt`와 `https://chaeda.kr/sitemap.xml`의 공개 응답을 확인한다.
2. Google Search Console·네이버 서치어드바이저에서 사이트 소유권과 현재 등록 상태를 확인한다. DNS 확인일 수 있으므로 소유 확인 메타 태그가 없다고 미등록으로 판단하지 않는다.
3. 홈페이지와 새 가이드의 실제 수집·색인 상태, 제목·본문·내부 링크가 읽히는지 검사한다.
4. 사이트맵을 제출하거나 갱신 상태를 확인한다. 제출 완료를 검색 노출·상위 순위·유입 성과로 기록하지 않는다.
5. 모바일에서 소개→가이드→예시 체험→스토어 이동을 확인한다. 예시 체험은 실제 계좌·거래가 아니다.

이 작업은 계정 설정·배포·검색 반영을 완료한 기록이 아니다. 로그인 계정과 배포본에서 별도 확인해야 한다.

## 배포 후 사용할 캠페인 링크

아래 주소는 **새 가이드가 배포된 다음** 외부 글에 사용한다. 값은 자유 입력 대신 `acquisition.js`의 허용 목록에서 선택한다.

| 위치 | 주소 |
|---|---|
| 인스타 프로필 | `https://chaeda.kr/guides/coupon-vs-yield/?utm_source=instagram&utm_medium=organic_social&utm_campaign=coupon_vs_yield_202610&utm_content=profile` |
| 인스타 스토리 | `https://chaeda.kr/guides/coupon-vs-yield/?utm_source=instagram&utm_medium=organic_social&utm_campaign=coupon_vs_yield_202610&utm_content=story` |
| 네이버 블로그 | `https://chaeda.kr/guides/coupon-vs-yield/?utm_source=naver_blog&utm_medium=referral&utm_campaign=coupon_vs_yield_202610&utm_content=blog` |
| 허용된 네이버 카페 게시판 | `https://chaeda.kr/guides/coupon-vs-yield/?utm_source=naver_cafe&utm_medium=community&utm_campaign=coupon_vs_yield_202610&utm_content=community` |
| 허용된 뽐뿌 게시판 | `https://chaeda.kr/guides/coupon-vs-yield/?utm_source=ppomppu&utm_medium=community&utm_campaign=coupon_vs_yield_202610&utm_content=community` |

`utm_source`와 `utm_medium`이 모두 허용값일 때 출처를 유지한다. 미등록 값·중복 키·이메일·토큰 같은 쿼리는 알려진 공개 페이지의 주소에서 제거한다. 알려진 내부 가이드·홈 링크에는 문서 준비 시 허용된 캠페인을 미리 붙여 가운데 클릭·우클릭 새 탭에서도 이어주고, 외부 스토어·메일·데모 iframe에는 덧붙이지 않는다. 클릭 이벤트 발행은 실제 클릭 때만 수행한다. 추적 링크가 없는 방문의 출처는 이 코드만으로 판단하지 않는다.

## 이벤트 정의와 로컬 확인

| 이벤트 | 뜻 | 뜻하지 않는 것 |
|---|---|---|
| `web_page_view` | 측정 스크립트가 로드된 공개 페이지 열기 | 순방문자·앱 실행 |
| `web_guide_open` | 다른 가이드로 가는 내부 링크 클릭 | 가이드 완독 |
| `web_demo_interest` | 예시 체험 구역으로 가는 링크 클릭 | 실제 체험 시작 |
| `web_demo_start` | 홈의 ‘체험하기’ 버튼 클릭 | iframe 로드 성공·체험 완료 |
| `web_store_click` | 채다의 Apple·Google 스토어 링크 클릭 | 설치·회원가입·활성 사용자 |

이벤트 속성은 허용된 `page`, 캠페인 값, `placement`, 스토어 종류뿐이다. 전체 URL·referrer·자유 입력·보유 금액은 전달하지 않는다. 예시 체험 내부 입력은 읽지 않는다. 새로고침하면 메모리 기록은 초기화된다.

브라우저 개발자 도구에서 다음으로 현재 페이지 기록과 연결 상태를 확인한다.

```js
ChaedaAcquisition.snapshot()
ChaedaAcquisition.status()
ChaedaPostHogAcquisition.status()
```

현재 공개 설정에서는 `externalCollectorConfigured`가 `false`이고 전송기 상태는 `configured: true`, `enabled: false`, `reason: 'disabled_in_config'`다. `configured`는 설정 형식 확인이며 데이터 수신을 의미하지 않는다. 활성화 후에도 `transportAccepted`는 HTTP 성공 응답 수일 뿐 PostHog 저장 확인은 별도다.

전송기는 수집기의 공개 프로젝트 토큰만 읽는다. 개인 API 키·조회·관리 권한을 웹에 넣지 않는다. 명시 연결 이후 새 이벤트만 전달하고 이전 메모리 기록을 자동 재전송하지 않는다. 한 페이지 전송 시도는 최대 50건이며 네트워크·CORS·HTTP 오류 시 자동 재시도하지 않는다. 페이지 이동이나 차단 도구로 일부 이벤트가 누락될 수 있다.

이벤트 속성에는 `$process_person_profile: false`, `$geoip_disable: true`, `$ip: '0.0.0.0'`을 지정해 인물 프로필과 위치 정보 연결을 막고 실제 IP를 이벤트에 저장하지 않도록 구성했다. 브라우저에서 PostHog로 직접 통신하므로 네트워크 접속 IP 자체의 전달을 막는다는 의미는 아니다. 실제 저장 속성은 수신 테스트에서 확인한다.

페이지마다 ID가 바뀌므로 PostHog의 고유 사용자·세션 숫자를 사람 수로 해석하지 않는다. 페이지를 넘는 사용자 단위 전환이나 앱 설치·사용까지의 연결도 이 구현만으로 확인할 수 없다.

## 공개 활성화 전 검토할 고지 초안

현재 개인정보처리방침의 외부 서비스·국외 이전 표에는 PostHog가 없고, 자동 수집 안내는 모바일 앱 도구 중심이다. 정책 원문은 이번 작업에서 임의로 변경하지 않았다. 아래는 실제 운영 조건을 확인한 뒤 고지에 반영할 검토용 내용이다.

### 구현에서 확인한 사항

- 목적: 공개 홈페이지·가이드의 방문과 링크 이용 흐름을 분석하고 콘텐츠 및 안내 동선을 개선한다.
- 항목: 허용된 페이지 종류, 이벤트 종류, 링크 위치, 스토어 종류, 미리 정한 캠페인 출처·매체·이름·소재 코드, 페이지 안에서만 사용하는 임의 ID.
- 외부 처리: 미국 리전 PostHog 수집 주소 `https://us.i.posthog.com`로 전송하도록 구성한다.
- 제외: 회원 ID·이메일·앱 인스턴스 ID·실제 보유내역·입력 금액·전체 주소·전체 referrer·자유 입력은 이벤트 본문에 넣지 않는다. 쿠키·localStorage·sessionStorage·자동 클릭 수집·세션 녹화·앱 사용자 연결을 사용하지 않는다.
- 거부: 브라우저의 Do Not Track 또는 Global Privacy Control 신호를 존중한다.
- IP: 이벤트에는 실제 IP·위치를 저장하지 않도록 구성하지만, 직접 네트워크 통신 과정에서 수신 서버가 접속 IP를 처리할 수 있다.

고지 문장 초안:

> 채다는 홈페이지와 채권 가이드의 이용 흐름을 개선하기 위해 PostHog를 이용할 수 있습니다. 분석 항목은 페이지와 이벤트 종류, 링크 위치, 스토어 종류, 미리 정한 캠페인 코드 및 페이지 안에서만 사용하는 임의 ID입니다. 회원 정보나 앱 이용자와 연결하지 않으며 쿠키 또는 브라우저 저장소에 분석 ID를 남기지 않습니다. 브라우저의 Do Not Track 또는 Global Privacy Control 거부 신호가 있으면 해당 웹 이벤트를 전송하지 않습니다. 데이터는 미국 리전의 PostHog 수집 서버로 전송되며, 직접 통신 과정에서 접속 IP가 처리될 수 있습니다.

### 운영자가 확인해야 할 사항

- 계약상 수탁자·이전받는 자의 정확한 명칭과 연락처.
- 실제 적용할 보관 기간 및 삭제 절차. 기존 앱 분석 보관 기간을 웹에도 자동 적용했다고 가정하지 않는다.
- 국외 이전의 적법 근거, 필요한 고지 항목·시점·방법, 동의 또는 거부 처리 방안.
- 공개 활성화 시점, 개인정보처리방침 개정·공지 방법, 실수신 속성과 보관 설정 확인.

확인 전에는 `acquisition-config.js`의 `enabled`를 `false`로 유지한다. 이 초안은 법적 요건 검토 또는 운영 설정 확인을 완료했다는 뜻이 아니다.

## 기술 근거

- [PostHog Capture API](https://posthog.com/docs/api/capture): 미국 수집 주소, `/i/v0/e/` POST, top-level `distinct_id`, 익명 이벤트의 `$process_person_profile` 설정.
- [PostHog 데이터 수집 제어](https://posthog.com/docs/privacy/data-collection): IP 처리·자동 수집 제어와 프라이버시 설정.
