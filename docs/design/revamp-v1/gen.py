#!/usr/bin/env python3
"""Generates PAYO revamp artboards (.dc.html) + canvas.json. Static hi-fi mockups."""
import json, pathlib

OUT = pathlib.Path(__file__).parent

# ---------- tokens ----------
L = dict(bg="#F7F4EE", surface="#FFFFFF", surface2="#F1EDE4", sep="#E7E1D6",
         ink="#0E2233", ink2="#5B6B78", ink3="#8A98A4", amber="#F2A93B", amberDeep="#D98F1F",
         amberTint="#FBEBD0", green="#1F9D6A", greenTint="#DDF3E9", red="#D64545", redTint="#FBE3E3",
         navy="#0D2A3D", white="#FFFFFF", aiBar="#0E2233")
D = dict(bg="#0B141C", surface="#14202A", surface2="#1C2A35", sep="#243441",
         ink="#F3F6F8", ink2="#A7B4BF", ink3="#6F7E8A", amber="#F5B34D", amberDeep="#E19A2A",
         amberTint="#3A2E19", green="#3FC48A", greenTint="#153826", red="#F06A6A", redTint="#3A1C1C",
         navy="#0D2A3D", white="#FFFFFF", aiBar="#1C2A35")

FONT_LINK = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Noto+Nastaliq+Urdu:wght@400;600;700&amp;display=swap">'

def css(t, rtl=False):
    fam = "'Noto Nastaliq Urdu', 'Plus Jakarta Sans', system-ui, sans-serif" if rtl else "'Plus Jakarta Sans', 'Helvetica Neue', Arial, system-ui, sans-serif"
    return f"""
body {{ margin:0; background:{t['bg']}; }}
a {{ color:{t['amberDeep']}; }} a:hover {{ color:{t['amber']}; }}
.phone {{ width:390px; height:844px; background:{t['bg']}; color:{t['ink']}; font-family:{fam}; position:relative; overflow:hidden; box-sizing:border-box; direction:{'rtl' if rtl else 'ltr'}; }}
.phone * {{ box-sizing:border-box; }}
.num {{ font-variant-numeric: tabular-nums; direction:ltr; unicode-bidi:isolate; }}
.scroll {{ position:absolute; top:0; left:0; right:0; bottom:176px; overflow:hidden; }}
.fade {{ position:absolute; left:0; right:0; bottom:176px; height:44px; background:linear-gradient(to bottom, {t['bg']}00, {t['bg']}); }}
.h1 {{ font-size:28px; font-weight:800; line-height:34px; letter-spacing:-0.4px; }}
.h2 {{ font-size:22px; font-weight:700; line-height:28px; letter-spacing:-0.2px; }}
.hl {{ font-size:17px; font-weight:600; line-height:22px; }}
.body {{ font-size:17px; font-weight:400; line-height:24px; }}
.sub {{ font-size:15px; font-weight:500; line-height:20px; color:{t['ink2']}; }}
.foot {{ font-size:13px; font-weight:500; line-height:18px; color:{t['ink3']}; }}
.cap {{ font-size:12px; font-weight:600; line-height:16px; letter-spacing:0.4px; text-transform:uppercase; color:{t['ink3']}; }}
.money {{ font-size:40px; font-weight:800; line-height:48px; letter-spacing:-1px; font-variant-numeric:tabular-nums; }}
.card {{ background:{t['surface']}; border-radius:20px; box-shadow:0 1px 2px rgba(14,34,51,0.04), 0 8px 24px rgba(14,34,51,0.06); }}
.btn {{ display:flex; align-items:center; justify-content:center; height:56px; border-radius:28px; background:{t['amber']}; color:{t['navy']}; font-size:17px; font-weight:700; }}
.btn2 {{ display:flex; align-items:center; justify-content:center; height:56px; border-radius:28px; background:{t['surface2']}; color:{t['ink']}; font-size:17px; font-weight:600; }}
.btnGhost {{ display:flex; align-items:center; justify-content:center; height:52px; border-radius:26px; color:{t['ink2']}; font-size:17px; font-weight:600; }}
.chip {{ display:inline-flex; align-items:center; white-space:nowrap; flex-shrink:0; height:36px; padding:0 14px; border-radius:18px; background:{t['surface2']}; color:{t['ink2']}; font-size:14px; font-weight:600; }}
.chipOn {{ background:{t['navy']}; color:{t['white']}; }}
.row {{ display:flex; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid {t['sep']}; }}
.avatar {{ width:44px; height:44px; border-radius:22px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; flex-shrink:0; }}
.icoCircle {{ width:44px; height:44px; border-radius:22px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }}
.input {{ height:56px; border-radius:16px; background:{t['surface']}; border:1.5px solid {t['sep']}; display:flex; align-items:center; padding:0 16px; gap:10px; color:{t['ink3']}; font-size:17px; }}
.inputOn {{ border-color:{t['amber']}; color:{t['ink']}; }}
.header {{ display:flex; align-items:center; justify-content:space-between; padding:56px 20px 8px; }}
.title {{ font-size:22px; font-weight:800; letter-spacing:-0.3px; }}
.content {{ padding:0 20px; }}
.aiBar {{ position:absolute; left:16px; right:16px; bottom:96px; height:60px; border-radius:30px; background:{t['aiBar']}; display:flex; align-items:center; padding:6px 8px 6px 6px; gap:12px; box-shadow:0 10px 30px rgba(14,34,51,0.28); }}
.tab {{ position:absolute; left:0; right:0; bottom:0; height:84px; background:{t['surface']}; border-top:1px solid {t['sep']}; display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); padding:8px 8px 24px; }}
.tabItem {{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; font-size:11px; font-weight:600; color:{t['ink3']}; }}
.tabOn {{ color:{t['amberDeep']}; }}
.kpad {{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:12px; }}
.key {{ height:64px; border-radius:20px; background:{t['surface']}; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:600; box-shadow:0 1px 2px rgba(14,34,51,0.05); }}
.dot {{ width:16px; height:16px; border-radius:8px; border:2px solid {t['ink3']}; }}
.dotOn {{ background:{t['amber']}; border-color:{t['amber']}; }}
.bubbleU {{ align-self:flex-end; max-width:280px; background:{t['navy']}; color:{t['white']}; padding:12px 16px; border-radius:20px 20px 6px 20px; font-size:16px; line-height:22px; }}
.bubbleA {{ align-self:flex-start; max-width:300px; background:{t['surface']}; color:{t['ink']}; padding:12px 16px; border-radius:20px 20px 20px 6px; font-size:16px; line-height:22px; box-shadow:0 1px 2px rgba(14,34,51,0.05); }}
.pill {{ display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 10px; border-radius:14px; font-size:12px; font-weight:700; }}
""" + ("""
.foot {{ line-height:26px; }} .sub {{ line-height:28px; }} .cap {{ line-height:24px; text-transform:none; letter-spacing:0; }}
.hl {{ line-height:32px; }} .body {{ line-height:36px; }} .tabItem {{ line-height:20px; font-size:12px; }} .chip {{ line-height:30px; }}
""".replace("{{","{").replace("}}","}") if rtl else "")

# ---------- icons (lucide-style, 24 grid, stroke) ----------
def ico(name, size=24, color="currentColor", sw=2):
    P = {
        "home": '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
        "list": '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
        "send": '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
        "grid": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
        "menu": '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
        "mic": '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
        "keyboard": '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01"/><path d="M10 8h.01"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/><path d="M7 16h10"/>',
        "chev": '<path d="m9 18 6-6-6-6"/>',
        "chevL": '<path d="m15 18-6-6 6-6"/>',
        "zap": '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
        "phone": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
        "piggy": '<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><path d="M16 11h.01"/>',
        "card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
        "file": '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/>',
        "user": '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        "qr": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3"/><path d="M21 14v7h-7"/><path d="M17 17h.01"/>',
        "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
        "eye": '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        "eyeOff": '<path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c7 0 10 8 10 8a13.2 13.2 0 0 1-1.7 2.6"/><path d="M6.6 6.6C3.9 8.4 2 12 2 12s3 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/>',
        "check": '<path d="M20 6 9 17l-5-5"/>',
        "x": '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        "plus": '<path d="M12 5v14"/><path d="M5 12h14"/>',
        "upRight": '<path d="M7 17 17 7"/><path d="M7 7h10v10"/>',
        "downLeft": '<path d="M17 7 7 17"/><path d="M17 17H7V7"/>',
        "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
        "globe": '<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
        "logout": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
        "shield": '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
        "receipt": '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>',
        "wallet": '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
        "sparkle": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
        "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        "snow": '<path d="M12 2v20"/><path d="M2 12h20"/><path d="m4.9 4.9 14.2 14.2"/><path d="m19.1 4.9-14.2 14.2"/>',
        "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
        "lock": '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
        "flame": '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.2-.2-4 2-5 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.2-2.4 1-3.5.5 1.4 1.5 2 2.5 2z"/>',
        "wifi": '<path d="M5 12.6a11 11 0 0 1 14 0"/><path d="M8.5 16.4a6 6 0 0 1 7 0"/><path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>',
        "drop": '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
        "share": '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/>',
        "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        "help": '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    }
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{P[name]}</svg>')

# ---------- building blocks ----------
def tabbar(t, active, labels=("Home", "Activity", "Pay", "More")):
    items = [("home", labels[0]), ("list", labels[1]), ("send", labels[2]), ("menu", labels[3])]
    out = '<div class="tab">'
    for i, (n, lab) in enumerate(items):
        on = i == active
        out += f'<div class="tabItem{" tabOn" if on else ""}">{ico(n, 24, t["amberDeep"] if on else t["ink3"], 2.2 if on else 2)}<span>{lab}</span></div>'
    return out + '</div>'

def aibar(t, text="Ask PAYO — say or type…"):
    return (f'<div class="aiBar">'
            f'<div style="width:48px;height:48px;border-radius:24px;background:{t["amber"]};display:flex;align-items:center;justify-content:center;flex-shrink:0;">{ico("mic", 24, t["navy"], 2.2)}</div>'
            f'<div style="flex:1;color:{t["white"]};font-size:16px;font-weight:600;opacity:0.92;">{text}</div>'
            f'<div style="width:40px;height:40px;border-radius:20px;background:rgba(255,255,255,0.10);display:flex;align-items:center;justify-content:center;flex-shrink:0;">{ico("keyboard", 20, "#FFFFFF", 2)}</div>'
            f'</div>')

def header(t, title, right="", back=False, sub=""):
    left = (f'<div style="display:flex;align-items:center;gap:8px;">{ico("chevL", 24, t["ink"], 2.2) if back else ""}'
            f'<div><div class="title">{title}</div>{f"<div class=\"foot\">{sub}</div>" if sub else ""}</div></div>')
    return f'<div class="header">{left}<div style="display:flex;gap:8px;">{right}</div></div>'

def icon_btn(t, name, bg=None):
    bg = bg or t["surface"]
    return f'<div style="width:44px;height:44px;border-radius:22px;background:{bg};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(14,34,51,0.06);">{ico(name, 22, t["ink"])}</div>'

def txn_row(t, initials, name, when, amount, positive=False, cat=None, bg=None, fg=None, icon=None):
    bg = bg or ("#E3EEF7" if not positive else t["greenTint"])
    fg = fg or ("#2E5B7A" if not positive else t["green"])
    left = ico(icon, 22, fg) if icon else initials
    amt_color = t["green"] if positive else t["ink"]
    sign = "+" if positive else "−"
    return (f'<div class="row"><div class="avatar" style="background:{bg};color:{fg};">{left}</div>'
            f'<div style="flex:1;min-width:0;"><div class="hl" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{name}</div>'
            f'<div class="foot">{when}{(" · " + cat) if cat else ""}</div></div>'
            f'<div class="hl num" style="color:{amt_color};">{sign}₨{amount}</div></div>')

def action_tile(t, icon, label, tint=None, w="calc(50% - 6px)"):
    tint = tint or t["amberTint"]
    return (f'<div class="card" style="width:{w};padding:16px;display:flex;flex-direction:column;gap:12px;">'
            f'<div class="icoCircle" style="background:{tint};">{ico(icon, 22, t["navy"] if tint == t["amberTint"] else t["ink"], 2.2)}</div>'
            f'<div class="hl">{label}</div></div>')

def quick_action(t, icon, label):
    return (f'<div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;">'
            f'<div style="width:56px;height:56px;border-radius:18px;background:{t["surface"]};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(14,34,51,0.05), 0 6px 16px rgba(14,34,51,0.06);">{ico(icon, 24, t["navy"], 2.2)}</div>'
            f'<div style="font-size:13px;font-weight:600;color:{t["ink2"]};text-align:center;">{label}</div></div>')

def balance_card(t, hidden=False, name="Ammi Jaan", amount="84,500", rtl=False, labels=None):
    labels = labels or dict(bal="Available balance", send="Send", request="Request", qr="My QR")
    amt = '₨ ••••••' if hidden else f'<span class="money">₨{amount}</span><span class="h2 num" style="color:{t["ink3"]};">.00</span>'
    return (f'<div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;">'
            f'<div style="display:flex;justify-content:space-between;align-items:center;">'
            f'<div class="cap">{labels["bal"]}</div>{ico("eye" if not hidden else "eyeOff", 20, t["ink3"])}</div>'
            f'<div class="num" style="display:flex;align-items:baseline;gap:2px;">{amt}</div>'
            f'<div class="foot">{name} · PAYO wallet · PKR</div>'
            f'<div style="display:flex;gap:10px;margin-top:4px;">'
            f'<div class="btn" style="flex:1;height:48px;border-radius:24px;gap:8px;">{ico("upRight", 20, t["navy"], 2.4)}{labels["send"]}</div>'
            f'<div class="btn2" style="flex:1;height:48px;border-radius:24px;gap:8px;">{ico("downLeft", 20, t["ink"], 2.4)}{labels["request"]}</div>'
            f'<div class="btn2" style="width:48px;height:48px;border-radius:24px;flex:none;">{ico("qr", 22, t["ink"], 2.2)}</div>'
            f'</div></div>')

def wrap(t, body, rtl=False, title=""):
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  {FONT_LINK}
  <style>{css(t, rtl)}</style>
</helmet>
<div class="phone">
{body}
</div>
</x-dc>
</body>
</html>
"""

# ---------- screens ----------
def screen_home(t, dark=False):
    body = f"""
<div class="scroll">
<div class="header" style="padding-top:60px;">
  <div style="display:flex;align-items:center;gap:12px;">
    <div class="avatar" style="width:40px;height:40px;border-radius:20px;background:{t['amberTint']};color:{t['navy']};">AJ</div>
    <div><div class="foot">Good morning</div><div class="hl">Ammi Jaan</div></div>
  </div>
  {icon_btn(t, "bell")}
</div>
<div class="content" style="display:flex;flex-direction:column;gap:20px;padding-top:8px;">
  {balance_card(t)}
  <div style="display:flex;gap:8px;">
    {quick_action(t, "send", "Send money")}{quick_action(t, "zap", "Pay bills")}{quick_action(t, "phone", "Top-up")}{quick_action(t, "piggy", "Savings")}
  </div>
  <div class="card" style="padding:14px 16px;display:flex;align-items:center;gap:12px;border:1px solid {t['sep']};box-shadow:none;background:{t['surface2']};">
    <div class="icoCircle" style="width:40px;height:40px;background:{t['redTint']};">{ico("zap", 20, t['red'], 2.2)}</div>
    <div style="flex:1;"><div class="hl">K-Electric bill due Sep 10</div><div class="foot">₨4,320 · Consumer ···5678</div></div>
    <div class="pill" style="background:{t['amber']};color:{t['navy']};height:32px;">Pay</div>
  </div>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div class="hl">Recent activity</div><div class="sub" style="color:{t['amberDeep']};">See all</div>
    </div>
    {txn_row(t, "BA", "Bilal Ahmed", "Today, 3:20 PM", "1,500", cat="Transfer")}
    {txn_row(t, "SK", "Sara Khan", "Today, 3:26 PM", "500", cat="Transfer")}
    {txn_row(t, "", "Meezan Savings", "Aug 28", "142,928", cat="Transfer", icon="wallet")}
  </div>
</div>
</div>
<div class="fade"></div>
{aibar(t)}
{tabbar(t, 0)}
"""
    return wrap(t, body)

def screen_home_option_b(t):
    body = f"""
<div class="scroll">
<div style="background:{t['navy']};padding:60px 20px 28px;border-radius:0 0 32px 32px;color:#fff;">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div class="avatar" style="width:40px;height:40px;border-radius:20px;background:rgba(255,255,255,0.14);color:#fff;">AJ</div>
      <div><div class="foot" style="color:rgba(255,255,255,0.6);">Good morning</div><div class="hl" style="color:#fff;">Ammi Jaan</div></div>
    </div>
    <div style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">{ico("bell", 22, "#fff")}</div>
  </div>
  <div class="cap" style="color:rgba(255,255,255,0.6);margin-top:26px;">Available balance</div>
  <div style="display:flex;align-items:baseline;gap:2px;margin-top:6px;"><span class="money" style="color:#fff;font-size:44px;">₨84,500</span><span class="h2 num" style="color:rgba(255,255,255,0.5);">.00</span></div>
  <div style="display:flex;gap:10px;margin-top:22px;">
    <div class="btn" style="flex:1;height:48px;border-radius:24px;gap:8px;">{ico("upRight", 20, t['navy'], 2.4)}Send</div>
    <div style="flex:1;height:48px;border-radius:24px;background:rgba(255,255,255,0.14);color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:600;">{ico("downLeft", 20, "#fff", 2.4)}Request</div>
    <div style="width:48px;height:48px;border-radius:24px;background:rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;">{ico("qr", 22, "#fff", 2.2)}</div>
  </div>
</div>
<div class="content" style="display:flex;flex-direction:column;gap:20px;padding-top:20px;">
  <div style="display:flex;gap:8px;">
    {quick_action(t, "send", "Send money")}{quick_action(t, "zap", "Pay bills")}{quick_action(t, "phone", "Top-up")}{quick_action(t, "piggy", "Savings")}
  </div>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div class="hl">Recent activity</div><div class="sub" style="color:{t['amberDeep']};">See all</div>
    </div>
    {txn_row(t, "BA", "Bilal Ahmed", "Today, 3:20 PM", "1,500", cat="Transfer")}
    {txn_row(t, "SK", "Sara Khan", "Today, 3:26 PM", "500", cat="Transfer")}
    {txn_row(t, "", "Jazz top-up", "Aug 27", "283", cat="Top-up", icon="phone")}
  </div>
</div>
</div>
<div class="fade"></div>
{aibar(t)}
{tabbar(t, 0)}
"""
    return wrap(t, body)

def screen_home_urdu(t):
    L2 = dict(bal="دستیاب بیلنس", send="بھیجیں", request="درخواست", qr="میرا کوڈ")
    body = f"""
<div class="scroll">
<div class="header" style="padding-top:60px;">
  <div style="display:flex;align-items:center;gap:12px;">
    <div class="avatar" style="width:40px;height:40px;border-radius:20px;background:{t['amberTint']};color:{t['navy']};font-family:'Plus Jakarta Sans';">AJ</div>
    <div><div class="foot">صبح بخیر</div><div class="hl" style="line-height:32px;">امی جان</div></div>
  </div>
  {icon_btn(t, "bell")}
</div>
<div class="content" style="display:flex;flex-direction:column;gap:20px;padding-top:8px;">
  {balance_card(t, name="امی جان", labels=L2)}
  <div style="display:flex;gap:8px;">
    {quick_action(t, "send", "پیسے بھیجیں")}{quick_action(t, "zap", "بل ادا کریں")}{quick_action(t, "phone", "لوڈ")}{quick_action(t, "piggy", "بچت")}
  </div>
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
      <div class="hl" style="line-height:32px;">حالیہ سرگرمی</div><div class="sub" style="color:{t['amberDeep']};">سب دیکھیں</div>
    </div>
    {txn_row(t, "BA", "بلال احمد", "آج، 3:20", "1,500", cat="منتقلی")}
    {txn_row(t, "SK", "سارہ خان", "آج، 3:26", "500", cat="منتقلی")}
  </div>
</div>
</div>
<div class="fade"></div>
{aibar(t, "PAYO سے پوچھیں — بولیں یا لکھیں…")}
{tabbar(t, 0, ("ہوم", "سرگرمی", "ادائیگی", "مزید"))}
"""
    return wrap(t, body, rtl=True)

def screen_login(t):
    dots = ''.join(f'<div class="dot{" dotOn" if i < 2 else ""}"></div>' for i in range(4))
    keys = ''.join(f'<div class="key">{k}</div>' for k in ["1","2","3","4","5","6","7","8","9"])
    body = f"""
<div class="content" style="padding-top:84px;display:flex;flex-direction:column;gap:20px;">
  <div style="display:flex;align-items:center;gap:10px;">
    <div style="width:40px;height:40px;border-radius:12px;background:{t['amber']};display:flex;align-items:center;justify-content:center;">{ico("wallet", 22, t['navy'], 2.4)}</div>
    <div style="font-size:22px;font-weight:800;letter-spacing:1px;">PAYO</div>
  </div>
  <div><div class="h1">Welcome back</div><div class="sub" style="margin-top:6px;">Banking that listens — in English and Urdu.</div></div>
  <div class="input inputOn">{ico("user", 20, t['ink3'])}<span>ammi@payo.demo</span></div>
  <div>
    <div class="sub" style="margin-bottom:12px;">Enter your 4-digit PIN</div>
    <div style="display:flex;gap:16px;justify-content:center;">{dots}</div>
  </div>
  <div class="kpad">{keys}<div class="key" style="background:transparent;box-shadow:none;color:{t['ink2']};font-size:15px;">Forgot?</div><div class="key">0</div><div class="key" style="background:transparent;box-shadow:none;">{ico("chevL", 24, t['ink2'])}</div></div>
  <div class="btn">Log in</div>
  <div class="sub" style="text-align:center;">New to PAYO? <span style="color:{t['amberDeep']};font-weight:700;">Create account</span></div>
</div>
"""
    return wrap(t, body)

def confirmation_card(t, to="Bilal Ahmed", detail="PAYO · +92 300 1110002", amount="1,500", fee="0", done=False):
    btn = (f'<div class="btn2" style="height:48px;color:{t["green"]};gap:8px;">{ico("check", 20, t["green"], 2.6)}Completed</div>' if done
           else f'<div class="btn" style="height:48px;">Confirm ₨{amount}</div>')
    return (f'<div class="card" style="align-self:flex-start;width:300px;padding:16px;display:flex;flex-direction:column;gap:12px;border:1.5px solid {t["amber"]};">'
            f'<div class="cap" style="color:{t["amberDeep"]};display:flex;align-items:center;gap:6px;">{ico("shield", 14, t["amberDeep"], 2.4)}Needs your confirmation</div>'
            f'<div style="display:flex;align-items:center;gap:12px;"><div class="avatar" style="background:#E3EEF7;color:#2E5B7A;">BA</div>'
            f'<div><div class="hl">{to}</div><div class="foot">{detail}</div></div></div>'
            f'<div style="display:flex;justify-content:space-between;align-items:baseline;"><span class="money num" style="font-size:32px;line-height:38px;">₨{amount}</span><span class="foot">Fee ₨{fee}</span></div>'
            f'{btn}</div>')

def screen_assistant(t, dark=False):
    body = f"""
{header(t, "PAYO Assistant", right=f'<div class="chip" style="height:32px;gap:6px;">{ico("globe", 16, t["ink2"])}EN · اردو</div>', back=True, sub="Understands English &amp; Urdu")}
<div class="content" style="display:flex;flex-direction:column;gap:12px;padding-top:10px;height:600px;overflow:hidden;">
  <div class="foot" style="text-align:center;margin:6px 0;">Today</div>
  <div class="bubbleU">Bilal ko 1500 rupees bhejo</div>
  <div class="bubbleA">Sending ₨1,500 to Bilal Ahmed. Please confirm on the card below.</div>
  {confirmation_card(t)}
  <div class="bubbleU">میرا بیلنس کتنا ہے؟</div>
  <div class="bubbleA" style="display:flex;flex-direction:column;gap:6px;"><span>آپ کا موجودہ بیلنس تراسی ہزار روپے ہے۔</span><span class="hl num" style="color:{t['green']};">₨83,000.00</span></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;">
    <div class="chip">Pay my electricity bill</div><div class="chip">Last month's statement</div>
  </div>
</div>
<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px 34px;background:{t['bg']};border-top:1px solid {t['sep']};display:flex;align-items:center;gap:10px;">
  <div class="input" style="flex:1;height:52px;border-radius:26px;">Type in English or Urdu…</div>
  <div style="width:60px;height:60px;border-radius:30px;background:{t['amber']};display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(242,169,59,0.45);">{ico("mic", 26, t['navy'], 2.4)}</div>
</div>
"""
    return wrap(t, body)

def screen_activity(t):
    chips = ''.join(f'<div class="chip{" chipOn" if i == 0 else ""}">{c}</div>' for i, c in enumerate(["All", "Transfers", "Bills", "Top-ups", "Savings"]))
    body = f"""
<div class="scroll">
{header(t, "Activity", right=icon_btn(t, "search"))}
<div class="content" style="display:flex;flex-direction:column;gap:16px;">
  <div style="display:flex;gap:8px;overflow:hidden;">{chips}</div>
  <div class="card" style="padding:14px 16px;display:flex;justify-content:space-between;">
    <div><div class="cap">Spent in Sep</div><div class="h2 num" style="margin-top:4px;">₨2,000</div></div>
    <div style="text-align:right;"><div class="cap">Received</div><div class="h2 num" style="margin-top:4px;color:{t['green']};">₨0</div></div>
  </div>
  <div>
    <div class="cap" style="margin:6px 0;">Today</div>
    {txn_row(t, "SK", "Sara Khan", "3:26 PM", "500", cat="Transfer")}
    {txn_row(t, "BA", "Bilal Ahmed", "3:20 PM", "1,500", cat="Transfer")}
    <div class="cap" style="margin:16px 0 6px;">August</div>
    {txn_row(t, "", "Meezan Savings", "Aug 28", "142,928", cat="Transfer", icon="wallet")}
    {txn_row(t, "", "Jazz top-up", "Aug 27", "283", cat="Top-up", icon="phone")}
    {txn_row(t, "", "K-Electric", "Aug 12", "4,120", cat="Bills", icon="zap", bg=t['redTint'], fg=t['red'])}
    {txn_row(t, "", "Salary — Stable Ltd", "Aug 1", "120,000", positive=True, cat="Income", icon="downLeft")}
  </div>
</div>
</div>
<div class="fade"></div>
{aibar(t)}
{tabbar(t, 1)}
"""
    return wrap(t, body)

def screen_receipt(t):
    def line(k, v, mono=False):
        return f'<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid {t["sep"]};"><span class="sub">{k}</span><span class="hl{" num" if mono else ""}">{v}</span></div>'
    body = f"""
{header(t, "Receipt", right=icon_btn(t, "share"), back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:20px;padding-top:12px;">
  <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 0 4px;">
    <div class="avatar" style="width:64px;height:64px;border-radius:32px;background:#E3EEF7;color:#2E5B7A;font-size:20px;">BA</div>
    <div class="hl">Sent to Bilal Ahmed</div>
    <div class="money num">−₨1,500</div>
    <div class="pill" style="background:{t['greenTint']};color:{t['green']};">{ico("check", 14, t['green'], 3)}Completed</div>
  </div>
  <div class="card" style="padding:4px 16px;">
    {line("Date", "Sep 2, 2026 · 3:20 PM")}{line("To", "PAYO · +92 300 1110002")}{line("Fee", "₨0", True)}{line("Category", "Transfer")}
    <div style="display:flex;justify-content:space-between;padding:12px 0;"><span class="sub">Reference</span><span class="hl num">PAYO-PW46VCDQV2</span></div>
  </div>
  <div class="btn2" style="gap:8px;">{ico("download", 20, t['ink'])}Save receipt</div>
  <div class="btnGhost">Report a problem</div>
</div>
"""
    return wrap(t, body)

def screen_pay(t):
    tiles = [("send", "Send money"), ("qr", "Scan QR"), ("zap", "Pay bills"), ("phone", "Mobile top-up"), ("downLeft", "Request money"), ("wallet", "My QR code")]
    grid = ''.join(action_tile(t, i, l) for i, l in tiles)
    body = f"""
<div class="scroll">
{header(t, "Pay")}
<div class="content" style="display:flex;flex-direction:column;gap:20px;">
  <div class="input">{ico("search", 20, t['ink3'])}<span>Search a contact or biller</span></div>
  <div style="display:flex;flex-wrap:wrap;gap:12px;">{grid}</div>
  <div>
    <div class="hl" style="margin-bottom:10px;">Recent people</div>
    <div style="display:flex;gap:16px;">
      {''.join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:64px;"><div class="avatar" style="width:56px;height:56px;border-radius:28px;background:{bg};color:{fg};font-size:16px;">{ini}</div><div class="foot" style="text-align:center;white-space:nowrap;">{nm}</div></div>' for ini, nm, bg, fg in [("BA","Bilal","#E3EEF7","#2E5B7A"),("SK","Sara K.",t['amberTint'],t['navy']),("SM","Sara M.",t['greenTint'],t['green']),("BJ","Bhai Jan","#EEE6F7","#6B4E9B")])}
    </div>
  </div>
</div>
</div>
<div class="fade"></div>
{aibar(t)}
{tabbar(t, 2)}
"""
    return wrap(t, body)

def screen_send_recipient(t):
    def crow(ini, name, sub, bg, fg, badge=None):
        b = f'<span class="pill" style="background:{t["surface2"]};color:{t["ink2"]};height:24px;">{badge}</span>' if badge else ico("chev", 20, t['ink3'])
        return f'<div class="row"><div class="avatar" style="background:{bg};color:{fg};">{ini}</div><div style="flex:1;"><div class="hl">{name}</div><div class="foot">{sub}</div></div>{b}</div>'
    body = f"""
{header(t, "Send money", back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:20px;">
  <div class="input inputOn">{ico("search", 20, t['ink3'])}<span style="color:{t['ink']};">Sara</span></div>
  <div style="display:flex;gap:10px;">
    <div class="chip chipOn" style="gap:6px;">{ico("user", 16, "#fff")}Contacts</div><div class="chip" style="gap:6px;">{ico("phone", 16, t['ink2'])}PAYO number</div><div class="chip" style="gap:6px;">{ico("wallet", 16, t['ink2'])}Bank account</div>
  </div>
  <div>
    <div class="cap" style="margin-bottom:4px;">2 matches</div>
    {crow("SK", "Sara Khan", "PAYO · +92 300 1110003", t['amberTint'], t['navy'])}
    {crow("SM", "Sara Malik", "PAYO · +92 300 1110004", t['greenTint'], t['green'])}
    <div class="cap" style="margin:16px 0 4px;">All contacts</div>
    {crow("BA", "Bilal Ahmed", "PAYO · +92 300 1110002", "#E3EEF7", "#2E5B7A")}
    {crow("BJ", "Bhai Jan", "Meezan Bank · PK36 ···· 6702", "#EEE6F7", "#6B4E9B", badge="Bank")}
  </div>
</div>
<div style="position:absolute;left:20px;right:20px;bottom:34px;"><div class="btn2" style="gap:8px;">{ico("plus", 20, t['ink'], 2.4)}Add new recipient</div></div>
"""
    return wrap(t, body)

def screen_send_amount(t):
    keys = ''.join(f'<div class="key">{k}</div>' for k in ["1","2","3","4","5","6","7","8","9"])
    body = f"""
{header(t, "Amount", back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:18px;">
  <div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:12px;">
    <div class="avatar" style="background:{t['amberTint']};color:{t['navy']};">SK</div>
    <div style="flex:1;"><div class="hl">Sara Khan</div><div class="foot">PAYO · +92 300 1110003</div></div><div class="sub" style="color:{t['amberDeep']};">Change</div>
  </div>
  <div style="text-align:center;padding:12px 0 0;">
    <div class="cap">You send</div>
    <div class="num" style="font-size:52px;font-weight:800;line-height:60px;letter-spacing:-1.5px;margin-top:6px;">₨500</div>
    <div class="foot" style="margin-top:6px;">Available ₨83,000 · No fee</div>
  </div>
  <div style="display:flex;gap:8px;justify-content:center;">{''.join(f'<div class="chip num">₨{a}</div>' for a in ["500","1,000","2,000","5,000"])}</div>
  <div class="input" style="height:48px;">{ico("receipt", 18, t['ink3'])}<span>Add a note (optional)</span></div>
  <div class="kpad">{keys}<div class="key" style="background:transparent;box-shadow:none;">.</div><div class="key">0</div><div class="key" style="background:transparent;box-shadow:none;">{ico("chevL", 24, t['ink2'])}</div></div>
  <div class="btn">Continue</div>
</div>
"""
    return wrap(t, body)

def screen_confirm(t):
    def line(k, v):
        return f'<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid {t["sep"]};"><span class="sub">{k}</span><span class="hl num">{v}</span></div>'
    body = f"""
{header(t, "Confirm transfer", back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:20px;padding-top:8px;">
  <div class="card" style="padding:20px;display:flex;flex-direction:column;align-items:center;gap:10px;">
    <div class="avatar" style="width:64px;height:64px;border-radius:32px;background:{t['amberTint']};color:{t['navy']};font-size:20px;">SK</div>
    <div class="hl">Sara Khan</div><div class="foot">PAYO · +92 300 1110003</div>
    <div class="money num" style="margin-top:6px;">₨500</div>
  </div>
  <div class="card" style="padding:4px 16px;">
    {line("Amount", "₨500.00")}{line("Fee", "₨0.00")}{line("Arrives", "Instantly")}
    <div style="display:flex;justify-content:space-between;padding:12px 0;"><span class="hl">Total</span><span class="hl num">₨500.00</span></div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;padding:0 4px;">{ico("lock", 18, t['ink3'])}<span class="foot">You'll confirm with your PIN. Money moves only after that.</span></div>
</div>
<div style="position:absolute;left:20px;right:20px;bottom:34px;display:flex;flex-direction:column;gap:8px;">
  <div class="btn">Confirm with PIN</div><div class="btnGhost">Cancel</div>
</div>
"""
    return wrap(t, body)

def screen_pin(t):
    dots = ''.join(f'<div class="dot{" dotOn" if i < 3 else ""}" style="width:18px;height:18px;border-radius:9px;"></div>' for i in range(4))
    keys = ''.join(f'<div class="key" style="height:72px;">{k}</div>' for k in ["1","2","3","4","5","6","7","8","9"])
    body = f"""
{header(t, "", right=icon_btn(t, "x"))}
<div class="content" style="display:flex;flex-direction:column;gap:28px;align-items:center;padding-top:24px;">
  <div style="width:64px;height:64px;border-radius:32px;background:{t['amberTint']};display:flex;align-items:center;justify-content:center;">{ico("lock", 28, t['navy'], 2.2)}</div>
  <div style="text-align:center;"><div class="h2">Enter your PIN</div><div class="sub" style="margin-top:6px;">Sending ₨500 to Sara Khan</div></div>
  <div style="display:flex;gap:20px;">{dots}</div>
  <div class="kpad" style="width:100%;">{keys}<div class="key" style="background:transparent;box-shadow:none;"></div><div class="key" style="height:72px;">0</div><div class="key" style="background:transparent;box-shadow:none;">{ico("chevL", 26, t['ink2'])}</div></div>
  <div class="sub">Forgot PIN?</div>
</div>
"""
    return wrap(t, body)

def screen_success(t):
    body = f"""
<div class="content" style="display:flex;flex-direction:column;align-items:center;gap:16px;padding-top:150px;text-align:center;">
  <div style="width:112px;height:112px;border-radius:56px;background:{t['greenTint']};display:flex;align-items:center;justify-content:center;">
    <div style="width:80px;height:80px;border-radius:40px;background:{t['green']};display:flex;align-items:center;justify-content:center;">{ico("check", 40, "#fff", 3)}</div>
  </div>
  <div class="h1" style="margin-top:8px;">Money sent</div>
  <div class="sub">Sara Khan received it instantly</div>
  <div class="money num">₨500</div>
  <div class="pill num" style="background:{t['surface2']};color:{t['ink2']};height:32px;">Ref PAYO-6B9F4KZ4M3</div>
</div>
<div style="position:absolute;left:20px;right:20px;bottom:34px;display:flex;flex-direction:column;gap:8px;">
  <div class="btn">Done</div><div class="btnGhost" style="gap:8px;">{ico("share", 18, t['ink2'])}Share receipt</div>
</div>
"""
    return wrap(t, body)

def screen_bills(t):
    def brow(icon, name, cat, bg, fg):
        return f'<div class="row"><div class="icoCircle" style="background:{bg};">{ico(icon, 22, fg, 2.2)}</div><div style="flex:1;"><div class="hl">{name}</div><div class="foot">{cat}</div></div>{ico("chev", 20, t["ink3"])}</div>'
    body = f"""
{header(t, "Pay bills", back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:20px;">
  <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px;border:1.5px solid {t['amber']};">
    <div style="display:flex;align-items:center;gap:12px;">
      <div class="icoCircle" style="background:{t['redTint']};">{ico("zap", 22, t['red'], 2.2)}</div>
      <div style="flex:1;"><div class="hl">K-Electric</div><div class="foot">Consumer 0400012345678 · Aug bill</div></div>
      <div class="pill" style="background:{t['redTint']};color:{t['red']};">Due Sep 10</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;"><div class="h2 num">₨4,320</div><div class="btn" style="height:44px;padding:0 24px;border-radius:22px;">Pay now</div></div>
  </div>
  <div>
    <div class="cap" style="margin-bottom:4px;">Utilities</div>
    {brow("zap", "K-Electric", "Electricity", t['redTint'], t['red'])}{brow("flame", "SSGC", "Gas", t['amberTint'], t['amberDeep'])}{brow("wifi", "PTCL", "Internet", "#E3EEF7", "#2E5B7A")}{brow("drop", "Karachi Water", "Water", "#DDEFF5", "#1E7A93")}
    <div class="cap" style="margin:16px 0 4px;">Mobile</div>
    {brow("phone", "Jazz · Zong · Telenor · Ufone", "Top-up any number", t['greenTint'], t['green'])}
  </div>
</div>
"""
    return wrap(t, body)

def screen_pockets(t):
    def pocket(emoji_icon, name, saved, goal, pct, bg):
        return (f'<div class="card" style="padding:16px;display:flex;flex-direction:column;gap:12px;">'
                f'<div style="display:flex;align-items:center;gap:12px;"><div class="icoCircle" style="background:{bg};">{ico(emoji_icon, 22, t["navy"], 2.2)}</div>'
                f'<div style="flex:1;"><div class="hl">{name}</div><div class="foot">Goal ₨{goal}</div></div><div class="hl num">₨{saved}</div></div>'
                f'<div style="height:8px;border-radius:4px;background:{t["surface2"]};"><div style="width:{pct}%;height:8px;border-radius:4px;background:{t["amber"]};"></div></div>'
                f'<div style="display:flex;justify-content:space-between;"><span class="foot">{pct}% there</span><span class="foot" style="color:{t["amberDeep"]};font-weight:700;">Add money</span></div></div>')
    body = f"""
{header(t, "Savings", right=icon_btn(t, "plus"), back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:16px;">
  <div class="card" style="padding:20px;background:{t['navy']};color:#fff;">
    <div class="cap" style="color:rgba(255,255,255,0.6);">Total saved</div>
    <div class="money num" style="color:#fff;margin-top:4px;">₨135,000</div>
    <div class="foot" style="color:rgba(255,255,255,0.6);margin-top:4px;">Across 2 pockets · set aside from your wallet</div>
  </div>
  {pocket("shield", "Umrah fund", "120,000", "500,000", 24, t['amberTint'])}
  {pocket("piggy", "Rainy day", "15,000", "50,000", 30, t['greenTint'])}
  <div class="btn2" style="gap:8px;">{ico("plus", 20, t['ink'], 2.4)}New pocket</div>
</div>
"""
    return wrap(t, body)

def screen_card(t):
    body = f"""
{header(t, "My card", back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:20px;">
  <div style="height:214px;border-radius:24px;background:linear-gradient(135deg, #12354F 0%, #0D2A3D 60%, #0A1F2E 100%);padding:22px;color:#fff;position:relative;overflow:hidden;box-shadow:0 16px 40px rgba(13,42,61,0.35);">
    <div style="position:absolute;right:-40px;top:-60px;width:220px;height:220px;border-radius:110px;background:radial-gradient(circle at 30% 30%, rgba(242,169,59,0.45), rgba(242,169,59,0) 65%);"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-weight:800;letter-spacing:1.5px;">PAYO</span><span class="pill" style="background:rgba(255,255,255,0.14);color:#fff;">Virtual</span></div>
    <div class="num" style="font-size:22px;font-weight:600;letter-spacing:3px;margin-top:52px;">4111 11•• •••• 8420</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;">
      <div><div class="cap" style="color:rgba(255,255,255,0.55);">Card holder</div><div style="font-weight:600;margin-top:2px;">AMMI JAAN</div></div>
      <div><div class="cap" style="color:rgba(255,255,255,0.55);">Expires</div><div class="num" style="font-weight:600;margin-top:2px;">09/29</div></div>
      <div style="width:44px;height:28px;border-radius:6px;background:rgba(255,255,255,0.18);"></div>
    </div>
  </div>
  <div style="display:flex;gap:12px;">
    <div class="card" style="flex:1;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;">{ico("eye", 22, t['ink'])}<span class="sub" style="color:{t['ink']};">Show details</span></div>
    <div class="card" style="flex:1;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;">{ico("snow", 22, t['ink'])}<span class="sub" style="color:{t['ink']};">Freeze</span></div>
    <div class="card" style="flex:1;padding:14px;display:flex;flex-direction:column;align-items:center;gap:8px;">{ico("settings", 22, t['ink'])}<span class="sub" style="color:{t['ink']};">Limits</span></div>
  </div>
  <div class="card" style="padding:4px 16px;">
    <div class="row" style="border:none;"><div class="icoCircle" style="background:{t['greenTint']};">{ico("check", 20, t['green'], 2.6)}</div><div style="flex:1;"><div class="hl">Card is active</div><div class="foot">Online payments enabled</div></div><div style="width:50px;height:30px;border-radius:15px;background:{t['green']};position:relative;"><div style="position:absolute;right:3px;top:3px;width:24px;height:24px;border-radius:12px;background:#fff;"></div></div></div>
  </div>
  <div>
    <div class="cap" style="margin-bottom:4px;">Card activity</div>
    {txn_row(t, "", "Daraz.pk", "Aug 22", "6,664", cat="Shopping", icon="card")}
    {txn_row(t, "", "Foodpanda", "Aug 19", "1,288", cat="Food", icon="card")}
  </div>
</div>
"""
    return wrap(t, body)

def screen_statements(t):
    def srow(m, inn, out):
        return (f'<div class="row"><div class="icoCircle" style="background:{t["surface2"]};">{ico("file", 20, t["ink2"])}</div>'
                f'<div style="flex:1;"><div class="hl">{m}</div><div class="foot num">In ₨{inn} · Out ₨{out}</div></div>'
                f'<div class="pill" style="background:{t["amberTint"]};color:{t["navy"]};gap:6px;">{ico("download", 14, t["navy"], 2.6)}PDF</div></div>')
    body = f"""
{header(t, "Statements", back=True)}
<div class="content" style="display:flex;flex-direction:column;gap:16px;">
  <div style="display:flex;gap:8px;"><div class="chip chipOn">2026</div><div class="chip">2025</div><div class="chip">Full year</div></div>
  <div class="card" style="padding:16px;display:flex;flex-direction:column;gap:10px;">
    <div class="cap">Request a statement</div>
    <div style="display:flex;gap:10px;"><div class="input" style="flex:1;height:48px;">August 2026</div><div class="btn" style="width:120px;height:48px;border-radius:24px;">Generate</div></div>
    <div class="foot">We'll email it too, if you like. PDFs are in English; the app shows Urdu.</div>
  </div>
  <div>
    <div class="cap" style="margin-bottom:4px;">Ready to download</div>
    {srow("August 2026", "120,000", "180,967")}{srow("July 2026", "120,000", "96,412")}{srow("June 2026", "120,000", "88,900")}
  </div>
</div>
"""
    return wrap(t, body)

def screen_more(t):
    def mrow(icon, name, sub="", danger=False, value=""):
        c = t['red'] if danger else t['ink']
        right = f'<span class="sub">{value}</span>' if value else ico("chev", 20, t['ink3'])
        return (f'<div class="row"><div class="icoCircle" style="width:40px;height:40px;background:{t["redTint"] if danger else t["surface2"]};">{ico(icon, 20, c, 2.2)}</div>'
                f'<div style="flex:1;"><div class="hl" style="color:{c};">{name}</div>{f"<div class=\"foot\">{sub}</div>" if sub else ""}</div>{right}</div>')
    body = f"""
<div class="scroll">
{header(t, "More")}
<div class="content" style="display:flex;flex-direction:column;gap:16px;">
  <div class="card" style="padding:16px;display:flex;align-items:center;gap:14px;">
    <div class="avatar" style="width:56px;height:56px;border-radius:28px;background:{t['amberTint']};color:{t['navy']};font-size:18px;">AJ</div>
    <div style="flex:1;"><div class="hl">Ammi Jaan</div><div class="foot">+92 300 1110001 · ammi@payo.demo</div></div>{ico("chev", 20, t['ink3'])}
  </div>
  <div class="card" style="padding:4px 16px;">
    {mrow("piggy", "Savings", "2 pockets · ₨135,000")}{mrow("card", "My card", "Virtual · active")}{mrow("file", "Statements")}
    {mrow("downLeft", "Requests", "1 pending")}
  </div>
  <div class="card" style="padding:4px 16px;">
    {mrow("globe", "Language", value="English")}{mrow("shield", "Security &amp; PIN")}{mrow("bell", "Notifications")}{mrow("help", "Help &amp; support")}
  </div>
  <div class="card" style="padding:4px 16px;">{mrow("logout", "Log out", danger=True)}</div>
  <div class="foot" style="text-align:center;">PAYO 1.0 · Demo build</div>
</div>
</div>
<div class="fade"></div>
{aibar(t)}
{tabbar(t, 3)}
"""
    return wrap(t, body)

def screen_foundations(t):
    sw = lambda name, hexv, dark=False: (f'<div style="display:flex;flex-direction:column;gap:6px;width:96px;"><div style="height:56px;border-radius:12px;background:{hexv};border:1px solid {t["sep"]};"></div>'
                                          f'<div class="foot" style="color:{t["ink"]};font-weight:700;">{name}</div><div class="foot num">{hexv}</div></div>')
    swatches = ''.join(sw(n, L[k]) for n, k in [("Ink", "ink"), ("Ink 2", "ink2"), ("Ink 3", "ink3"), ("Amber", "amber"), ("Amber deep", "amberDeep"), ("Amber tint", "amberTint"), ("Green", "green"), ("Red", "red"), ("Navy", "navy"), ("Cream bg", "bg"), ("Surface 2", "surface2"), ("Separator", "sep")])
    dswatches = ''.join(sw(n, D[k]) for n, k in [("Dark bg", "bg"), ("Dark surface", "surface"), ("Dark surface 2", "surface2"), ("Dark ink", "ink"), ("Dark amber", "amber")])
    body = f"""
<div style="width:1100px;padding:40px;font-family:'Plus Jakarta Sans', system-ui, sans-serif;color:{t['ink']};background:{t['bg']};display:flex;flex-direction:column;gap:32px;box-sizing:border-box;">
  <div><div class="h1">PAYO design foundations</div><div class="sub" style="margin-top:6px;">Warm, trustworthy, elder-friendly. Stable DNA (amber on navy, soft cards, pill buttons) rebuilt as PAYO's own system.</div></div>
  <div><div class="cap" style="margin-bottom:12px;">Color — light</div><div style="display:flex;gap:16px;flex-wrap:wrap;">{swatches}</div></div>
  <div><div class="cap" style="margin-bottom:12px;">Color — dark (desaturated, not inverted)</div><div style="display:flex;gap:16px;flex-wrap:wrap;">{dswatches}</div></div>
  <div style="display:grid;grid-template-columns:repeat(2, minmax(0,1fr));gap:32px;">
    <div><div class="cap" style="margin-bottom:12px;">Type — Plus Jakarta Sans (Aeonik stand-in) · Noto Nastaliq Urdu for اردو</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div class="money">₨84,500 <span class="foot">Money 40/48 · 800 · tabular</span></div>
        <div class="h1">Large title <span class="foot">28/34 · 800</span></div>
        <div class="h2">Title <span class="foot">22/28 · 700</span></div>
        <div class="hl">Headline <span class="foot">17/22 · 600</span></div>
        <div class="body">Body — the elder-friendly floor is 17pt, scaling with Dynamic Type. <span class="foot">17/24 · 400</span></div>
        <div class="sub">Subhead 15/20 · 500</div><div class="foot">Footnote 13/18 · 500</div><div class="cap">Caption 12 · 600 · caps</div>
        <div style="font-family:'Noto Nastaliq Urdu';font-size:19px;line-height:36px;">اردو میں بھی اتنا ہی خوبصورت — نستعلیق، 19pt، بلند لائن ہائٹ</div>
      </div>
    </div>
    <div><div class="cap" style="margin-bottom:12px;">Shape, spacing, controls</div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div class="btn" style="width:280px;">Primary — amber pill, 56pt</div>
        <div class="btn2" style="width:280px;">Secondary — surface pill, 56pt</div>
        <div style="display:flex;gap:8px;"><div class="chip chipOn">Chip on</div><div class="chip">Chip</div><div class="pill" style="background:{t['greenTint']};color:{t['green']};">{ico("check", 14, t['green'], 3)}Status</div></div>
        <div class="input inputOn" style="width:280px;">{ico("search", 20, t['ink3'])}<span>Input — 56pt, 16 radius, amber focus</span></div>
        <div class="foot">Radii: card 20 · button 28 (pill) · input 16 · tile 18 · avatar circle<br>Spacing: 4 / 8 / 12 / 16 / 20 / 24 / 32 · screen gutter 20<br>Touch targets ≥ 44pt, primary CTAs 56pt · Icons Lucide 24, stroke 2<br>Shadows: 0 8 24 rgba(14,34,51,.06) on cards; none in dark (use surface steps)<br>AI bar: navy pill docked 12pt above the tab bar on all four tabs</div>
      </div>
    </div>
  </div>
</div>
"""
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  {FONT_LINK}
  <style>{css(t)}</style>
</helmet>
{body}
</x-dc>
</body>
</html>
"""

# ---------- emit ----------
files = {
    "Main.dc.html": screen_home(L),
    "Login.dc.html": screen_login(L),
    "Assistant.dc.html": screen_assistant(L),
    "Activity.dc.html": screen_activity(L),
    "Receipt.dc.html": screen_receipt(L),
    "PayHub.dc.html": screen_pay(L),
    "SendRecipient.dc.html": screen_send_recipient(L),
    "SendAmount.dc.html": screen_send_amount(L),
    "Confirm.dc.html": screen_confirm(L),
    "Pin.dc.html": screen_pin(L),
    "Success.dc.html": screen_success(L),
    "Bills.dc.html": screen_bills(L),
    "Pockets.dc.html": screen_pockets(L),
    "Card.dc.html": screen_card(L),
    "Statements.dc.html": screen_statements(L),
    "More.dc.html": screen_more(L),
    "HomeDark.dc.html": screen_home(D),
    "AssistantDark.dc.html": screen_assistant(D),
    "HomeUrdu.dc.html": screen_home_urdu(L),
    "HomeOptionB.dc.html": screen_home_option_b(L),
    "Foundations.dc.html": screen_foundations(L),
}
for name, html in files.items():
    (OUT / name).write_text(html, encoding="utf-8")

rows = [
    ["Login.dc.html", "Main.dc.html", "Assistant.dc.html", "Activity.dc.html", "Receipt.dc.html"],
    ["PayHub.dc.html", "SendRecipient.dc.html", "SendAmount.dc.html", "Confirm.dc.html", "Pin.dc.html", "Success.dc.html"],
    ["Bills.dc.html", "Pockets.dc.html", "Card.dc.html", "Statements.dc.html", "More.dc.html"],
    ["HomeDark.dc.html", "AssistantDark.dc.html", "HomeUrdu.dc.html", "HomeOptionB.dc.html"],
]
titles = {"Main.dc.html": "Home (Option A — recommended)", "HomeOptionB.dc.html": "Home (Option B — navy hero)", "HomeDark.dc.html": "Home · dark", "AssistantDark.dc.html": "Assistant · dark", "HomeUrdu.dc.html": "Home · اردو (RTL)", "PayHub.dc.html": "Pay", "SendRecipient.dc.html": "Send — recipient", "SendAmount.dc.html": "Send — amount", "Confirm.dc.html": "Confirm", "Pin.dc.html": "PIN gate"}
artboards = []
y = 0
for r in rows:
    for i, f in enumerate(r):
        ab = {"file": f, "x": i * 480, "y": y, "w": 390, "h": 844}
        if f in titles: ab["title"] = titles[f]
        artboards.append(ab)
    y += 844 + 140
artboards.append({"file": "Foundations.dc.html", "x": 0, "y": y, "w": 1100, "h": 760, "title": "Design foundations"})
notes = [
    {"id": "note-brief", "x": -520, "y": 0, "w": 420, "text": "PAYO revamp — for your approval\n\nRow 1: Login, Home, Assistant, Activity, Receipt\nRow 2: Pay hub, Send (recipient → amount → confirm → PIN → success)\nRow 3: Bills, Savings, Card, Statements, More\nRow 4: Dark mode, Urdu (RTL), Home Option B\n\nEnglish-first. Assistant understands English, Urdu and code-mixed input; replies follow the app language.\nAI bar is docked above the tabs on every tab screen — one tap to speak or type from anywhere.\nMoney safety gate unchanged: confirm → PIN → execute."},
    {"id": "note-options", "x": 1440 + 480, "y": 3 * (844 + 140), "w": 380, "text": "Home: two directions\n\nOption A (recommended): cream background, white balance card — calm, bank-like, best readability for older users.\n\nOption B: navy hero header with the balance on dark — bolder brand presence, closer to Stable's dark bars, slightly lower contrast for body text below.\n\nPick one; everything else stays the same."},
]
canvas = {"artboards": artboards, "annotations": notes, "launch": {"view": "canvas"}}
(OUT / "canvas.json").write_text(json.dumps(canvas, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"wrote {len(files)} artboards + canvas.json")
