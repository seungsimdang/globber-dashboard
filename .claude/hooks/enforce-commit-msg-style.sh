#!/bin/sh
# PreToolUse(Bash) 훅: git commit 메시지가 .claude/skills/git-commit/SKILL.md의 기계적으로 검증
# 가능한 규칙을 지키는지 확인. 대화 중 다짐이 아니라 훅으로 강제하기 위해 도입 - 커밋 메시지
#
# 여기서 강제하는 것 (SKILL.md 중 grep/awk로 기계적으로 판정 가능한 항목만):
#   1. 종결어미 금지 - 요약 줄·bullet이 "~했다/~한다"류로 끝나면 안 되고 "~추가/~구현/~교체/~수정"류
#      명사형 필수
#   2. em-dash(—) 금지 - 하이픈(-)만 사용
#   3. 본문 임의 줄바꿈 금지 - bullet이든 평문 문단이든 한 항목은 한 줄로 작성(뷰어의 자동 줄바꿈에
#      맡긴다). bullet 뒤 이어지는 줄뿐 아니라, bullet 없는 평문 문단이 여러 줄로 쪼개진 경우도
#      같은 문제로 함께 처리
# 커밋 분리 기준·본문 생략 여부 같은 설계 판단은 훅으로 강제할 수 없어 제외

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

case "$cmd" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

# 커밋 메시지 본문 추출. 이 저장소의 표준 패턴(-m "$(cat <<'EOF' ... EOF)")을
# 우선 처리하고, heredoc이 없으면 첫 -m "..." 인자로 폴백한다.
delim=$(printf '%s\n' "$cmd" | grep -oE "<<[ 	]*['\"]?[A-Za-z_][A-Za-z0-9_]*['\"]?" | head -1 | sed -E "s/<<[ 	]*['\"]?([A-Za-z_][A-Za-z0-9_]*)['\"]?/\1/")
if [ -n "$delim" ]; then
  msg=$(printf '%s\n' "$cmd" | sed -n "/<<[ 	]*['\"]\\{0,1\\}$delim['\"]\\{0,1\\}[ 	]*\$/,/^[ 	]*$delim[ 	]*\$/p" | sed '1d;$d')
else
  msg=$(printf '%s\n' "$cmd" | grep -oE '\-m[ 	]+"([^"\\]|\\.)*"' | head -1 | sed -E 's/^-m[ 	]+"//; s/"$//')
fi
[ -n "$msg" ] || exit 0

fail_reason=""

# 1) em-dash 금지
if printf '%s' "$msg" | grep -qF '—'; then
  fail_reason="em-dash(—)가 포함되어 있습니다. 하이픈(-)만 쓰세요."
fi

# 2) 본문 임의 줄바꿈 금지: 요약 줄(1번째 줄) 이후, 비어있지 않은 줄 바로
#    다음에 "- "로 시작하지 않는 비어있지 않은 줄이 오면 위반이다 - bullet
#    뒤 이어지는 줄이든, bullet 없는 평문 문단이 쪼개진 것이든 동일하게 잡는다.
#    (heredoc 추출 단계에서 이미 EOF 등 종료 토큰은 제거된 $msg 만 검사한다.)
if [ -z "$fail_reason" ]; then
  hit=$(printf '%s\n' "$msg" | awk '
    function is_blank(s,   t) { t = s; gsub(/^[ \t]+|[ \t]+$/, "", t); return (t == "") }
    NR == 1 { prev = $0; next }
    {
      if (!is_blank(prev) && !is_blank($0) && $0 !~ /^[ \t]*-[ \t]/) {
        print $0
        exit
      }
      prev = $0
    }
  ')
  if [ -n "$hit" ]; then
    fail_reason="본문이 여러 줄로 임의 줄바꿈된 것으로 보입니다. 이어지는 줄: \"$hit\" (뷰어가 알아서 줄바꿈합니다 - bullet이든 평문 문단이든 한 항목은 한 줄로 쓰세요)"
  fi
fi

# 3) 종결어미 금지: 요약 줄(첫 줄)과 각 bullet 줄이 "~다" 류 종결형으로 끝나면 안 된다.
if [ -z "$fail_reason" ]; then
  summary=$(printf '%s\n' "$msg" | head -1)
  bullets=$(printf '%s\n' "$msg" | grep -E '^[ \t]*-[ \t]')
  hit=$(printf '%s\n%s\n' "$summary" "$bullets" | grep -E '다[.!]?[ \t]*$' | head -1)
  if [ -n "$hit" ]; then
    fail_reason="완결형 어미로 끝나는 줄이 있습니다: \"$hit\" (예: ~했다/~한다 대신 ~추가/~구현/~수정 같은 명사형으로 쓰세요)"
  fi
fi

if [ -n "$fail_reason" ]; then
  echo "차단: 커밋 메시지가 .claude/skills/git-commit/SKILL.md 규칙을 위반합니다." >&2
  echo "→ $fail_reason" >&2
  exit 2
fi

exit 0
