import { useId } from "react";
export default function WordArt({
  concept,
  className = "",
  label = "Иллюстрация к заданию",
}: {
  concept: string;
  className?: string;
  label?: string;
}) {
  const id = useId().replace(/:/g, "");
  const tree = (x: number, y: number, s: number, c: string) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M0 0 28 64H12l29 44H21l28 47H-49l28-47h-20l29-44h-16Z"
        fill={c}
      />
      <path d="M-4 140h8v48h-8z" fill="#515441" />
    </g>
  );
  let art;
  switch (concept) {
    case "forest":
      art = (
        <>
          <circle cx="290" cy="95" r="43" fill="#e7d4a1" opacity=".7" />
          <path d="M0 180 135 80l120 103L400 65l80 115v140H0Z" fill="#3e5047" />
          {[
            [-20, 100, 1.1],
            [52, 72, 1.3],
            [135, 135, 0.9],
            [210, 110, 1],
            [310, 90, 1.3],
            [400, 50, 1.5],
            [480, 110, 1],
          ].map(([x, y, s]) => tree(x, y, s, "#263e35"))}
          <path
            d="M210 320q25-62 53-95t-6-47q64 24 24 66t-7 76"
            fill="#aeab87"
            opacity=".8"
          />
          {tree(36, 135, 1.5, "#192e29")}
          {tree(427, 120, 1.6, "#1a302a")}
          <path
            d="M0 270q130-23 244 6t236-3v47H0Z"
            fill="#152c26"
            opacity=".5"
          />
        </>
      );
      break;
    case "mountain":
    case "courage":
      art = (
        <>
          <circle cx="340" cy="82" r="39" fill="#c9b079" />
          <path d="M-20 320 167 55l122 192L380 112 520 320" fill="#7d8983" />
          <path d="m167 55-66 92 50-21 16 17 17-20 38 25Z" fill="#dbded1" />
          <path d="M55 320 226 138 380 320" fill="#3f5750" />
          <path d="m226 138-45 49 36-8 15 14 15-18 21 12Z" fill="#c7cec2" />
          <path
            d="M0 320v-35l74-32 74 67m171 0 94-91 67 40v51"
            fill="#223f35"
          />
        </>
      );
      break;
    case "ocean":
      art = (
        <>
          <circle cx="310" cy="115" r="46" fill="#dbc392" />
          <path d="M0 175q80-15 160 0t160 0 160 0v145H0Z" fill="#4b7475" />
          <path
            d="M0 207q60-12 120 0t120 0 120 0 120 0m-470 42q80-12 160 0t160 0 150 0m-470 38q60-10 120 0t120 0 120 0 120 0"
            fill="none"
            stroke="#aac0ae"
            strokeWidth="3"
            opacity=".5"
          />
          <path d="m264 183-50 3 12 10h28z" fill="#283d37" />
          <path d="M239 180v-60l-32 55h28" fill="#e6dbb8" />
        </>
      );
      break;
    case "bridge":
      art = (
        <>
          <path d="M0 153q95-100 185-20t295-27v214H0" fill="#455e4b" />
          <path d="M0 256q160-24 240 0t240-4v68H0" fill="#65817c" />
          <path
            d="M40 183h400v40h-27q-44-77-88 0h-34q-51-88-102 0h-32q-43-77-88 0H40Z"
            fill="#b9b095"
          />
          <path
            d="M35 176h410v11H35m11-34h392M54 149v27m35-27v27m35-27v27m35-27v27m35-27v27m35-27v27m35-27v27m35-27v27m35-27v27m35-27v27m35-27v27m28-27v27"
            stroke="#d1c7aa"
            strokeWidth="5"
          />
          {tree(18, 60, 0.8, "#293f32")}
          {tree(450, 67, 0.8, "#293f32")}
        </>
      );
      break;
    case "book":
      art = (
        <>
          <ellipse
            cx="244"
            cy="270"
            rx="160"
            ry="18"
            fill="#0d1715"
            opacity=".3"
          />
          <path
            d="M240 106Q168 61 72 94v151q86-26 168 16 82-42 168-16V94q-96-33-168 12"
            fill="#bca171"
          />
          <path
            d="M240 98Q172 57 83 86v146q86-26 157 18 71-44 157-18V86q-89-29-157 12"
            fill="#e7ddc0"
          />
          <path d="M240 99v151" stroke="#a99470" strokeWidth="3" />
          <path
            d="m110 117 95 13m-95 9 95 13m-95 9 95 13m-95 9 68 10m100-63 92-13m-92 35 92-13m-92 35 92-13m-92 35 62-9"
            stroke="#a49b80"
            strokeWidth="3"
            opacity=".7"
          />
          <path d="M267 90v86l15-13 15 7V82" fill="#8c644c" />
        </>
      );
      break;
    case "coffee":
      art = (
        <>
          <ellipse cx="238" cy="268" rx="124" ry="22" fill="#aa9772" />
          <ellipse cx="238" cy="263" rx="95" ry="13" fill="#d0bea0" />
          <path
            d="M312 143q85-13 65 55-13 35-58 27"
            fill="none"
            stroke="#d8ccb0"
            strokeWidth="17"
          />
          <path d="M139 142h186l-13 78q-9 42-80 42t-80-42Z" fill="#dfd3b9" />
          <ellipse cx="232" cy="142" rx="93" ry="22" fill="#bca27b" />
          <ellipse cx="232" cy="143" rx="80" ry="15" fill="#5d4536" />
          <path
            d="M196 109q-25-26 0-47m38 44q-25-26 0-47m38 50q-25-26 0-47"
            fill="none"
            stroke="#ddcfb2"
            opacity=".5"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </>
      );
      break;
    case "window":
      art = (
        <>
          <path d="M139 54h202v227H139Z" fill="#ac9773" />
          <path d="M151 66h178v202H151Z" fill="#66877c" />
          <circle cx="280" cy="110" r="25" fill="#e9d2a0" />
          <path d="M151 205q45-74 96-19t82-4v86H151" fill="#3a5c48" />
          <path d="M240 65v206m-90-103h180" stroke="#d0bc98" strokeWidth="10" />
          <path d="M124 271h232v15H124" fill="#d3bc94" />
          <path
            d="M121 43h237M125 44q50 80 0 202m230-202q-50 80 0 202"
            stroke="#546656"
            fill="none"
            strokeWidth="27"
          />
        </>
      );
      break;
    case "time":
      art = (
        <>
          <circle cx="240" cy="168" r="105" fill="#b59b6c" />
          <circle cx="240" cy="168" r="94" fill="#e2d6b8" />
          <circle cx="240" cy="168" r="82" fill="none" stroke="#aaa082" />
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d="M240 88v10"
              stroke="#645e4a"
              strokeWidth="3"
              transform={`rotate(${i * 30} 240 168)`}
            />
          ))}
          <path
            d="M240 114v54l41 26"
            fill="none"
            stroke="#404e3f"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <circle cx="240" cy="168" r="7" fill="#a48354" />
        </>
      );
      break;
    case "key":
      art = (
        <g transform="rotate(-30 240 160)">
          <circle
            cx="187"
            cy="138"
            r="52"
            fill="none"
            stroke="#c4a264"
            strokeWidth="20"
          />
          <path
            d="M238 138h120v21h-20v25h-23v-25h-31v22h-23v-22h-23Z"
            fill="#c4a264"
          />
          <path d="M246 142h98" stroke="#ecd5a1" strokeWidth="3" />
        </g>
      );
      break;
    case "rain":
      art = (
        <>
          <path
            d="M145 124a42 42 0 0 1 31-72 61 61 0 0 1 116 5 43 43 0 0 1 50 67Z"
            fill="#9da99b"
          />
          {[140, 185, 230, 275, 320].map((x, i) => (
            <path
              key={x}
              d={`m${x} ${150 + (i % 2) * 23}-13 29m10 25-13 29`}
              stroke="#9db9b0"
              strokeWidth="5"
              strokeLinecap="round"
            />
          ))}
          <path
            d="M114 285q125-21 251 0"
            stroke="#738b80"
            strokeWidth="2"
            fill="none"
          />
        </>
      );
      break;
    case "heart":
      art = (
        <path
          d="M240 263 137 165C70 86 190 28 240 109c50-81 170-23 103 56Z"
          fill="#b76f66"
          stroke="#d69483"
          strokeWidth="4"
        />
      );
      break;
    case "bloom":
      art = (
        <>
          <path
            d="M240 288V147m0 85q-63-4-64-45 58-6 64 45m0 27q70-5 70-48-59-2-70 48"
            stroke="#70876a"
            fill="#70876a"
            strokeWidth="5"
          />
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse
              key={i}
              cx="240"
              cy="108"
              rx="23"
              ry="43"
              fill={i % 2 ? "#c9ac76" : "#d8be8d"}
              transform={`rotate(${i * 60} 240 144)`}
            />
          ))}
          <circle cx="240" cy="144" r="22" fill="#8c6b40" />
        </>
      );
      break;
    case "light":
    case "sunrise":
      art = (
        <>
          <circle cx="240" cy="155" r="61" fill="#e2c184" />
          {Array.from({ length: 10 }, (_, i) => (
            <path
              key={i}
              d="M240 58v-17"
              stroke="#c3a775"
              strokeWidth="4"
              strokeLinecap="round"
              transform={`rotate(${i * 36} 240 155)`}
            />
          ))}
          <path d="M0 247q96-91 210 0 102-116 270 0v73H0Z" fill="#4b604a" />
          <path d="M0 275q130-39 267 8t213-10v47H0Z" fill="#293f34" />
        </>
      );
      break;
    case "home":
      art = (
        <>
          <path d="M126 159 240 64l114 95v122H126Z" fill="#bcb198" />
          <path
            d="m106 164 134-115 134 115"
            fill="none"
            stroke="#75634b"
            strokeWidth="18"
            strokeLinejoin="round"
          />
          <path
            d="M215 210h50v71h-50M153 168h38v43h-38m137-43h38v43h-38"
            fill="#5e796e"
          />
          {tree(58, 127, 0.85, "#3c5845")}
          {tree(426, 127, 0.85, "#3c5845")}
        </>
      );
      break;
    case "ice":
      art = (
        <>
          <path d="m167 122 113-34 65 52-109 40Z" fill="#c5d9d3" />
          <path d="m167 122 69 58v104l-69-65Z" fill="#8faeaa" />
          <path d="m236 180 109-40v103l-109 41Z" fill="#a8c5c1" />
          <path
            d="m193 150 45 24 78-28m-77 45v68"
            stroke="#e9f1df"
            strokeWidth="3"
            opacity=".6"
          />
        </>
      );
      break;
    case "gold":
      art = (
        <>
          <path d="m153 153 160-19 39 97-218 23Z" fill="#b9944e" />
          <path d="m153 153 26-39 117-12 17 32Z" fill="#e0bf79" />
          <path d="m313 134 33-7 39 94-33 10Z" fill="#8e6c39" />
          <path
            d="m245 61 5 17 17 5-17 6-5 17-6-17-17-6 17-5Z"
            fill="#eddaa7"
          />
        </>
      );
      break;
    case "dream":
      art = (
        <>
          <path
            d="M277 58a90 90 0 1 0 83 133A91 91 0 0 1 277 58Z"
            fill="#d9c48f"
          />
          {[
            [140, 72],
            [360, 83],
            [110, 190],
            [330, 260],
          ].map(([x, y]) => (
            <path
              key={x}
              d={`m${x} ${y - 8} 3 5 5 3-5 3-3 5-3-5-5-3 5-3Z`}
              fill="#c9b78e"
            />
          ))}
          <path
            d="M127 277q70-40 139-7t120-9"
            fill="none"
            stroke="#657768"
            strokeWidth="3"
          />
        </>
      );
      break;
    case "journey":
      art = (
        <>
          <circle cx="310" cy="100" r="36" fill="#dac08c" />
          <path
            d="M0 219 107 103l100 117 84-75 99 76 90-66v165H0Z"
            fill="#5e715b"
          />
          <path d="M0 257q147-87 255-16t225-11v90H0Z" fill="#344f3f" />
          <path
            d="M170 320q116-56 96-83t15-40q-64 22-33 47t-155 76"
            fill="#b2a680"
          />
        </>
      );
      break;
    default:
      art = (
        <>
          <rect
            x="149"
            y="75"
            width="182"
            height="188"
            rx="12"
            fill="none"
            stroke="#7f8d78"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
          <path
            d="m189 202 37-43 25 27 20-20 25 36"
            fill="none"
            stroke="#a0ac92"
            strokeWidth="5"
          />
          <circle cx="278" cy="123" r="12" fill="#b2a477" />
        </>
      );
  }
  return (
    <svg
      className={`word-art ${className}`}
      viewBox="0 0 480 320"
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={`${id}bg`} x2="1" y2="1">
          <stop stopColor="#293b33" />
          <stop offset="1" stopColor="#182922" />
        </linearGradient>
        <radialGradient id={`${id}glow`}>
          <stop stopColor="#b9ab78" stopOpacity=".12" />
          <stop offset="1" stopColor="#b9ab78" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="480" height="320" fill={`url(#${id}bg)`} />
      <circle cx="240" cy="130" r="240" fill={`url(#${id}glow)`} />
      {art}
    </svg>
  );
}
