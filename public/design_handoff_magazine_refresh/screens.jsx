/* JustB magazine refresh — 4 screen components.
   Each accepts { dark, accent } and renders into a 402×874 viewport (sits inside <IOSFrame>).
   Static design — not a working app. Color/type tokens come from CSS vars on the wrapper. */

// ─── helpers ──────────────────────────────────────────────────────────────
function Placeholder({ label, height = 220, tone = 'sand', dark = false }) {
  // Soft atmospheric color blocks standing in for Pexels photos.
  // tone presets pick a dominant hue; the mono label tells the user what the photo is.
  const tones = {
    sand:   ['#e9d9b8', '#c9a878'],
    sunset: ['#f1c89a', '#b96d3e'],
    bloom:  ['#cfd9b0', '#7d9560'],
    deep:   ['#1f2a44', '#0b1224'],
    field:  ['#a8b189', '#6b7a4d'],
    stone:  ['#cbc3b3', '#8a8474'],
    rust:   ['#d7a37b', '#8e4f2a'],
    sky:    ['#cfdcec', '#7a96b6'],
  };
  const [a, b] = tones[tone] || tones.sand;
  return (
    <div style={{
      position: 'relative', width: '100%', height,
      background: `linear-gradient(155deg, ${a} 0%, ${b} 100%)`,
      overflow: 'hidden',
    }}>
      {/* fine-grain overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.04) 0 2px, transparent 2px 5px)',
        mixBlendMode: 'overlay',
      }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(120% 80% at 30% 30%, rgba(255,255,255,.18), transparent 60%)',
      }} />
      <span style={{
        position: 'absolute', left: 10, bottom: 8,
        fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
        fontSize: 9, letterSpacing: 0.5,
        color: dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.35)',
        textTransform: 'lowercase',
      }}>// {label}</span>
    </div>
  );
}

function Rule({ dark, weight = 1, color }) {
  return <div style={{ height: weight, background: color || (dark ? 'rgba(232,226,211,.18)' : 'rgba(28,26,22,.12)'), width: '100%' }} />;
}

function Eyebrow({ children, dark, accent }) {
  return (
    <div style={{
      fontFamily: 'Geist, ui-sans-serif, system-ui', fontSize: 10, fontWeight: 500,
      letterSpacing: '0.22em', textTransform: 'uppercase',
      color: accent, display: 'inline-flex', alignItems: 'center', gap: 8,
    }}>
      <span style={{ width: 14, height: 1, background: accent }} />
      {children}
    </div>
  );
}

function CatMark({ label, dark, accent }) {
  return (
    <span style={{
      fontFamily: 'Geist, ui-sans-serif, system-ui', fontSize: 9.5, fontWeight: 500,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: accent,
      borderTop: `1px solid ${accent}`, paddingTop: 4,
      display: 'inline-block', minWidth: 56,
    }}>{label}</span>
  );
}

// ─── 1. LOCATION ──────────────────────────────────────────────────────────
function ScreenLocation({ dark, accent }) {
  const fg = dark ? '#e8e2d3' : '#1c1a16';
  const sub = dark ? '#9a9385' : '#6e655a';
  const faint = dark ? '#6c6757' : '#a39787';
  const fieldBorder = dark ? 'rgba(232,226,211,.18)' : 'rgba(28,26,22,.14)';

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      padding: '72px 28px 40px', boxSizing: 'border-box',
      color: fg,
    }}>
      {/* top meta */}
      <div style={{
        fontFamily: 'Geist, ui-sans-serif', fontSize: 10, letterSpacing: '0.28em',
        color: faint, textTransform: 'uppercase', textAlign: 'center',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
      }}>
        <span>Vol. 26</span>
        <span style={{ width: 3, height: 3, borderRadius: 3, background: faint }} />
        <span>Sat · May 16</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        {/* Wordmark */}
        <h1 style={{
          fontFamily: '"DM Serif Display", "Source Serif 4", Georgia, serif',
          fontSize: 96, fontWeight: 400, lineHeight: 0.95, margin: 0,
          color: fg, letterSpacing: '-0.02em',
        }}>
          JustB
        </h1>
        <p style={{
          fontFamily: '"Source Serif 4", Georgia, serif', fontStyle: 'italic',
          fontSize: 19, lineHeight: 1.3, margin: '18px 0 0', color: sub, fontWeight: 300,
          maxWidth: 280,
        }}>
          just be here.<br />just be now.
        </p>

        {/* small ornament */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 28 }}>
          <span style={{ width: 24, height: 1, background: faint }} />
          <span style={{ width: 4, height: 4, transform: 'rotate(45deg)', background: accent }} />
          <span style={{ width: 24, height: 1, background: faint }} />
        </div>
      </div>

      {/* location field */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          fontFamily: 'Geist, ui-sans-serif', fontSize: 10, letterSpacing: '0.22em',
          color: faint, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center',
        }}>
          where are you, today
        </div>
        <div style={{
          position: 'relative',
          borderBottom: `1px solid ${fieldBorder}`,
          paddingBottom: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 20, color: fg,
          }}>
            <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
              <path d="M7 17s6-6.5 6-11A6 6 0 1 0 1 6c0 4.5 6 11 6 11z" stroke={accent} strokeWidth="1.4"/>
              <circle cx="7" cy="6.2" r="1.7" fill={accent}/>
            </svg>
            <span>Sea</span>
            <span style={{
              width: 1, height: 18, background: accent, marginLeft: 1,
              animation: 'caret 1.1s steps(2) infinite',
            }} />
            <span style={{ flex: 1 }} />
            <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
              <path d="M1 6h13M10 1l5 5-5 5" stroke={fg} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
        </div>

        {/* suggestions */}
        <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0 }}>
          {[
            { name: 'SeaTac', region: 'Washington' },
            { name: 'Carmel-by-the-Sea', region: 'California' },
            { name: 'Seabrook', region: 'Texas' },
          ].map((s, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'baseline', gap: 14,
              padding: '10px 0',
              borderBottom: i < 2 ? `1px solid ${fieldBorder}` : 'none',
            }}>
              <span style={{
                fontFamily: 'Geist, ui-sans-serif', fontSize: 9, letterSpacing: '0.18em',
                color: faint, textTransform: 'uppercase', minWidth: 18,
              }}>{String(i+1).padStart(2,'0')}</span>
              <span style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 17, color: fg, flex: 1 }}>
                {s.name}
              </span>
              <span style={{ fontFamily: 'Geist, ui-sans-serif', fontSize: 11, color: sub, fontStyle: 'normal', letterSpacing: '0.04em' }}>
                {s.region}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── 2. READY (click and hold) ────────────────────────────────────────────
function ScreenReady({ dark, accent }) {
  const fg = dark ? '#e8e2d3' : '#1c1a16';
  const sub = dark ? '#9a9385' : '#6e655a';
  const faint = dark ? '#6c6757' : '#a39787';
  const ring = dark ? 'rgba(232,226,211,.22)' : 'rgba(28,26,22,.16)';
  const skyGrad = dark
    ? 'linear-gradient(180deg, #1a2138 0%, #0f111a 100%)'
    : 'linear-gradient(180deg, #cfe1f0 0%, #eef2ec 60%, transparent 100%)';

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      display: 'flex', flexDirection: 'column',
      color: fg,
    }}>
      {/* atmospheric sky */}
      <div style={{
        position: 'absolute', inset: '0 0 auto 0', height: 260,
        background: skyGrad, pointerEvents: 'none',
      }} />
      {/* horizon ornament — a moon for night, faint star for day */}
      {dark && (
        <div style={{
          position: 'absolute', top: 80, right: 60,
          width: 38, height: 38, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #f1e8c8 0%, #d2c290 60%, #8d7b48 100%)',
          boxShadow: '0 0 30px rgba(241,232,200,0.15)',
        }} />
      )}

      <div style={{ height: 72 }} />
      {/* masthead */}
      <div style={{ position: 'relative', textAlign: 'center', padding: '0 28px' }}>
        <div style={{
          fontFamily: 'Geist, ui-sans-serif', fontSize: 10, letterSpacing: '0.28em',
          color: dark ? '#b9b09d' : '#5f5648', textTransform: 'uppercase',
        }}>
          Seattle · Saturday, May 16
        </div>
        <h2 style={{
          fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30,
          fontWeight: 400, margin: '14px 0 0', lineHeight: 1.05, letterSpacing: '-0.01em',
          color: fg,
        }}>
          Two slow breaths,<br /><em style={{ color: accent, fontStyle: 'italic', fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 300 }}>then today.</em>
        </h2>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* disc */}
        <div style={{
          width: 280, height: 280, borderRadius: '50%',
          border: `1px solid ${ring}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          boxShadow: dark
            ? 'inset 0 0 60px rgba(232,226,211,0.04), 0 8px 30px rgba(0,0,0,0.4)'
            : 'inset 0 0 60px rgba(28,26,22,0.03), 0 8px 30px rgba(28,26,22,0.06)',
        }}>
          {/* progress ring (illustrative — partial fill) */}
          <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="140" cy="140" r="139" fill="none" stroke={accent} strokeWidth="1.5"
                    strokeDasharray={2 * Math.PI * 139}
                    strokeDashoffset={2 * Math.PI * 139 * 0.72} strokeLinecap="round" opacity="0.85"/>
          </svg>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: 'Geist, ui-sans-serif', fontSize: 9.5, letterSpacing: '0.28em',
              color: accent, textTransform: 'uppercase', marginBottom: 10,
            }}>
              Press &amp; hold
            </div>
            <div style={{
              fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 26,
              fontWeight: 400, color: fg, lineHeight: 1,
            }}>
              Hold to<br/>begin
            </div>
            <div style={{
              marginTop: 14,
              fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 12, fontStyle: 'italic',
              color: sub,
            }}>
              two seconds
            </div>
          </div>
        </div>
      </div>

      {/* footer almanac */}
      <div style={{
        padding: '0 28px 28px',
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14,
        fontFamily: 'Geist, ui-sans-serif', fontSize: 11, color: sub,
      }}>
        <span>48°F</span>
        <span style={{ width: 2, height: 2, borderRadius: 2, background: faint }} />
        <span>{dark ? 'moonrise 10:12' : 'sunset 8:40'}</span>
        <span style={{ width: 2, height: 2, borderRadius: 2, background: faint }} />
        <span>{dark ? 'waning crescent' : 'high tide 5:25 pm'}</span>
      </div>
    </div>
  );
}

// ─── 3. BREATHING ─────────────────────────────────────────────────────────
function ScreenBreathing({ dark, accent }) {
  const fg = dark ? '#e8e2d3' : '#1c1a16';
  const sub = dark ? '#9a9385' : '#6e655a';
  const faint = dark ? '#6c6757' : '#a39787';
  const ring = dark ? 'rgba(232,226,211,.16)' : 'rgba(28,26,22,.11)';
  const skyGrad = dark
    ? 'linear-gradient(180deg, #1a2138 0%, #0f111a 100%)'
    : 'linear-gradient(180deg, #c6d8eb 0%, #ecf0e9 70%, transparent 100%)';

  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      display: 'flex', flexDirection: 'column',
      color: fg,
    }}>
      <div style={{
        position: 'absolute', inset: '0 0 auto 0', height: 340,
        background: skyGrad, pointerEvents: 'none',
      }} />

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {/* shrinking circle — mid-exhale */}
        <div style={{
          width: 220, height: 220, borderRadius: '50%',
          border: `1px solid ${ring}`,
          background: dark ? 'rgba(232,226,211,0.02)' : 'rgba(255,255,255,0.4)',
          boxShadow: dark
            ? '0 8px 40px rgba(0,0,0,0.5), inset 0 0 60px rgba(232,226,211,0.03)'
            : '0 8px 40px rgba(28,26,22,0.05), inset 0 0 60px rgba(28,26,22,0.02)',
          transition: 'all 1s ease',
        }} />
      </div>

      <div style={{ padding: '0 28px 80px', textAlign: 'center' }}>
        <p style={{
          fontFamily: '"DM Serif Display", Georgia, serif', fontSize: 30,
          fontWeight: 400, margin: 0, color: fg, lineHeight: 1.1,
        }}>
          Breathe out<span style={{ color: accent }}>…</span>
        </p>
        <div style={{
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
          marginTop: 18,
        }}>
          <span style={{ width: 18, height: 1, background: faint }} />
          <span style={{
            fontFamily: 'Geist, ui-sans-serif', fontSize: 10, letterSpacing: '0.24em',
            color: sub, textTransform: 'uppercase',
          }}>
            Breath 1 <span style={{ color: faint }}>of</span> 2
          </span>
          <span style={{ width: 18, height: 1, background: faint }} />
        </div>
        <p style={{
          marginTop: 22,
          fontFamily: '"Source Serif 4", Georgia, serif', fontStyle: 'italic',
          fontSize: 14, color: sub, lineHeight: 1.5, maxWidth: 240, marginLeft: 'auto', marginRight: 'auto',
        }}>
          let the shoulders drop. let the day arrive.
        </p>
      </div>
    </div>
  );
}

// ─── 4. FEED ──────────────────────────────────────────────────────────────
function ScreenFeed({ dark, accent }) {
  const bg = dark ? '#0f111a' : '#f5efe4';
  const fg = dark ? '#e8e2d3' : '#1c1a16';
  const sub = dark ? '#9a9385' : '#6e655a';
  const faint = dark ? '#6c6757' : '#a39787';
  const rule = dark ? 'rgba(232,226,211,.13)' : 'rgba(28,26,22,.11)';

  // Typography helpers shared in cards
  const serifDisplay = '"DM Serif Display", Georgia, serif';
  const serifBody = '"Source Serif 4", Georgia, serif';
  const sans = 'Geist, ui-sans-serif, system-ui';

  return (
    <div style={{
      width: '100%', minHeight: '100%',
      background: bg, color: fg, position: 'relative',
    }}>
      {/* atmospheric top wash */}
      <div style={{
        position: 'absolute', inset: '0 0 auto 0', height: 220,
        background: dark
          ? 'linear-gradient(180deg, rgba(48,62,98,.35) 0%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(198,216,235,.7) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', padding: '52px 22px 60px' }}>
        {/* masthead */}
        <header style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: serifDisplay, fontSize: 28, color: fg, lineHeight: 1 }}>JustB</div>
            <div style={{ fontFamily: sans, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: sub }}>
              Vol. 26 · No. 136
            </div>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, fontFamily: sans, fontSize: 11, color: sub }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <svg width="9" height="11" viewBox="0 0 9 11" fill="none">
                <path d="M4.5 10.5s4-4.3 4-7.3a4 4 0 1 0-8 0c0 3 4 7.3 4 7.3z" stroke={accent} strokeWidth="1.1"/>
                <circle cx="4.5" cy="3.2" r="1" fill={accent}/>
              </svg>
              <span style={{ color: fg, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: faint }}>Seattle, WA</span>
            </span>
            <span style={{ width: 2, height: 2, borderRadius: 2, background: faint }} />
            <span>Saturday, May 16 · 2026</span>
          </div>
          {/* almanac strip */}
          <div style={{
            marginTop: 14, padding: '10px 0',
            borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: sans, fontSize: 10.5, color: sub,
          }}>
            {[
              ['48°', dark ? 'clear' : 'partly'],
              [dark ? '8:40p' : '5:39a', dark ? 'set' : 'rise'],
              [dark ? '10:12p' : '8:40p', dark ? 'moonrise' : 'sunset'],
              [dark ? '◐' : '🌒', dark ? 'crescent' : 'waxing'].slice(0,2),
              ['5:25p', 'tide ↑'],
            ].map(([v, l], i, arr) => (
              <React.Fragment key={i}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 36 }}>
                  <span style={{ color: fg, fontFamily: serifBody, fontSize: 13, fontFeatureSettings: '"tnum"' }}>{v}</span>
                  <span style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: faint }}>{l}</span>
                </span>
                {i < arr.length - 1 && <span style={{ width: 1, height: 22, background: rule }} />}
              </React.Fragment>
            ))}
          </div>
        </header>

        {/* Section eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <span style={{ width: 24, height: 1, background: accent }} />
          <span style={{ fontFamily: sans, fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: accent, fontWeight: 500 }}>
            Today in Seattle
          </span>
        </div>

        {/* LEAD ARTICLE */}
        <article style={{ marginBottom: 36 }}>
          <Placeholder label="sunset over puget sound, golden hour" tone={dark ? 'deep' : 'sunset'} height={320} dark={dark} />
          <div style={{ marginTop: 16 }}>
            <CatMark label="Sky · Almanac" dark={dark} accent={accent} />
            <h2 style={{
              fontFamily: serifDisplay, fontSize: 36, fontWeight: 400, lineHeight: 1.02,
              margin: '12px 0 14px', color: fg, letterSpacing: '-0.015em',
            }}>
              Evening glow peaks at <span style={{ fontStyle: 'italic', fontFamily: serifBody, fontWeight: 300 }}>7:56</span>&nbsp;tonight
            </h2>
            <p style={{ fontFamily: serifBody, fontStyle: 'italic', fontSize: 16, lineHeight: 1.45, color: sub, margin: '0 0 14px', fontWeight: 300 }}>
              A 45-minute window of warm, directional light along the waterfront — the longest of the year sits ten days off.
            </p>
            <p style={{ fontFamily: serifBody, fontSize: 15, lineHeight: 1.6, color: fg, margin: 0 }}>
              <span style={{
                fontFamily: serifDisplay, fontSize: 44, lineHeight: 0.85, float: 'left',
                paddingRight: 8, paddingTop: 4, color: accent,
              }}>T</span>
              he golden hour arrives early today, spanning 7:56 to 8:40 — fifteen hours and nine minutes
              of daylight, two extra over yesterday. The solstice turn is close enough now to feel in your bones.
            </p>
            <div style={{ marginTop: 16, display: 'flex', gap: 16, fontFamily: sans, fontSize: 10.5, color: faint, letterSpacing: '0.06em' }}>
              <span>7:56—8:40 <span style={{ color: sub }}>PM</span></span>
              <span style={{ color: rule }}>|</span>
              <span>45 <span style={{ color: sub }}>min window</span></span>
              <span style={{ color: rule }}>|</span>
              <span>longest-day trend <span style={{ color: sub }}>alert</span></span>
            </div>
          </div>
        </article>

        <Rule dark={dark} />

        {/* WILDFLOWERS — image left, text right ish */}
        <article style={{ margin: '28px 0' }}>
          <Placeholder label="lupines + trillium, pacific nw understory" tone="bloom" height={200} dark={dark} />
          <div style={{ marginTop: 14 }}>
            <CatMark label="Nature" dark={dark} accent={accent} />
            <h3 style={{
              fontFamily: serifDisplay, fontSize: 24, fontWeight: 400,
              lineHeight: 1.1, margin: '10px 0 10px', color: fg, letterSpacing: '-0.01em',
            }}>
              Late-spring wildflowers peak around Puget Sound
            </h3>
            <p style={{ fontFamily: serifBody, fontSize: 14, lineHeight: 1.55, color: sub, margin: 0 }}>
              By mid May, the Pacific Northwest wildflower season hits its stride: bleeding heart, trillium and
              columbine bloom across forest understory; native rhododendrons light up clearings in shades of pink and purple.
            </p>
            <p style={{ fontFamily: sans, fontSize: 11, marginTop: 12, color: faint, letterSpacing: '0.04em' }}>
              <em style={{ color: sub }}>Field note · </em> Discovery Park · Schmitz Preserve · Saint Edward
            </p>
          </div>
        </article>

        <Rule dark={dark} />

        {/* HISTORY — PULL QUOTE */}
        <article style={{
          margin: '32px -22px',
          padding: '36px 30px 32px',
          background: dark ? 'rgba(232,226,211,0.03)' : 'rgba(28,26,22,0.025)',
          borderTop: `1px solid ${rule}`, borderBottom: `1px solid ${rule}`,
          position: 'relative',
        }}>
          <span style={{
            position: 'absolute', top: 10, left: 22,
            fontFamily: serifDisplay, fontSize: 80, lineHeight: 1, color: accent, opacity: 0.35,
          }}>“</span>
          <CatMark label="History · 97 yrs ago" dark={dark} accent={accent} />
          <p style={{
            fontFamily: serifDisplay, fontSize: 26, fontWeight: 400,
            lineHeight: 1.15, margin: '12px 0 14px', color: fg, fontStyle: 'italic', letterSpacing: '-0.005em',
          }}>
            The first Academy Awards were handed out at the Hollywood Roosevelt — a fifteen-minute ceremony, a five-dollar dinner.
          </p>
          <p style={{ fontFamily: sans, fontSize: 11, color: sub, letterSpacing: '0.06em' }}>
            May 16, 1929 · 270 in attendance · Pacific NW theaters still carry the tradition.
          </p>
        </article>

        {/* VENUS — stat treatment */}
        <article style={{ margin: '28px 0' }}>
          <CatMark label="Space" dark={dark} accent={accent} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'end', marginTop: 10 }}>
            <h3 style={{
              fontFamily: serifDisplay, fontSize: 28, fontWeight: 400,
              lineHeight: 1.05, margin: 0, color: fg, letterSpacing: '-0.01em',
            }}>
              Venus dominates the west-northwest sky after dusk
            </h3>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: serifDisplay, fontSize: 40, color: accent, lineHeight: 1 }}>9:30<span style={{ fontSize: 18, color: sub, marginLeft: 2 }}>pm</span></div>
              <div style={{ fontFamily: sans, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: faint, marginTop: 4 }}>
                impossible-to-miss
              </div>
            </div>
          </div>
          <p style={{ fontFamily: serifBody, fontSize: 14, lineHeight: 1.55, color: sub, margin: '12px 0 0' }}>
            For 45 minutes after dark Venus blazes unmistakably bright, well above the horizon. Binoculars catch fainter Mercury,
            now emerging from the evening twilight.
          </p>
        </article>

        <Rule dark={dark} />

        {/* SECTION HEADER */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '32px 0 16px' }}>
          <h4 style={{
            fontFamily: serifDisplay, fontSize: 18, fontWeight: 400, margin: 0,
            color: fg, letterSpacing: '-0.005em',
          }}>
            Local pulse
          </h4>
          <span style={{ fontFamily: sans, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: faint }}>
            live signals
          </span>
        </div>

        {/* PULSE — sparse text-only list */}
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {[
            { kicker: 'Sports', time: '4:15 PM', title: 'Mariners host Padres at T-Mobile Park' },
            { kicker: 'Happenings', time: '6:00 PM', title: 'Phantom · Wicked · Beauty — three theaters open downtown' },
            { kicker: 'Local Scene', time: 'All day', title: 'Wallingford 45th — bookstores, cafés, vintage shops' },
          ].map((p, i) => (
            <li key={i} style={{
              display: 'grid', gridTemplateColumns: '54px 1fr auto', gap: 12, alignItems: 'baseline',
              padding: '14px 0', borderBottom: i < 2 ? `1px solid ${rule}` : 'none',
            }}>
              <span style={{ fontFamily: sans, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent }}>
                {p.kicker}
              </span>
              <span style={{ fontFamily: serifBody, fontSize: 15, lineHeight: 1.3, color: fg }}>
                {p.title}
              </span>
              <span style={{ fontFamily: sans, fontSize: 11, color: sub, fontFeatureSettings: '"tnum"' }}>
                {p.time}
              </span>
            </li>
          ))}
        </ul>

        {/* SECTION */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '36px 0 16px' }}>
          <h4 style={{ fontFamily: serifDisplay, fontSize: 18, fontWeight: 400, margin: 0, color: fg }}>
            Field notes
          </h4>
          <span style={{ fontFamily: sans, fontSize: 9.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: faint }}>
            almanac
          </span>
        </div>

        {/* EARTH-GARDEN — typographic */}
        <article style={{ marginBottom: 28 }}>
          <CatMark label="Earth · Garden" dark={dark} accent={accent} />
          <h3 style={{
            fontFamily: serifDisplay, fontSize: 22, fontWeight: 400,
            lineHeight: 1.1, margin: '10px 0 10px', color: fg, letterSpacing: '-0.01em',
          }}>
            A safe planting day — frost risk has nearly passed
          </h3>
          <p style={{ fontFamily: serifBody, fontSize: 14, lineHeight: 1.55, color: sub, margin: 0 }}>
            Seattle's last frost normally lands by May 10–20, depending on microclimate. Today marks the tail end of that risk —
            direct-sow beans, squash and basil; settle tomato starts after sundown.
          </p>
        </article>

        {/* BIRDS */}
        <article>
          <CatMark label="Nature · Migration" dark={dark} accent={accent} />
          <h3 style={{
            fontFamily: serifDisplay, fontSize: 22, fontWeight: 400,
            lineHeight: 1.1, margin: '10px 0 10px', color: fg, letterSpacing: '-0.01em',
          }}>
            Warblers and swallows settle in for breeding season
          </h3>
          <p style={{ fontFamily: serifBody, fontSize: 14, lineHeight: 1.55, color: sub, margin: 0 }}>
            Late May means the tail end of spring migration. Warbler activity in Seattle parks is winding down; violet-green
            swallows and Swainson's thrushes are building nests. Early mornings at Green Lake or Discovery offer the best birding before summer.
          </p>
        </article>

        {/* footer mark */}
        <div style={{ textAlign: 'center', marginTop: 56, paddingTop: 22, borderTop: `1px solid ${rule}` }}>
          <div style={{ fontFamily: serifDisplay, fontSize: 13, color: faint, letterSpacing: '0.04em' }}>· JustB ·</div>
          <div style={{ fontFamily: sans, fontSize: 9.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: faint, marginTop: 4 }}>
            just be here. just be now.
          </div>
        </div>
      </div>
    </div>
  );
}

// expose
Object.assign(window, {
  ScreenLocation, ScreenReady, ScreenBreathing, ScreenFeed, Placeholder, Rule, Eyebrow, CatMark,
});
