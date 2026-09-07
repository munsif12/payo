#!/usr/bin/env python3
"""Generate PAYO AI-first (Direction B + A greeting) wireframe artboards as .dc.html + canvas.json.
Mid-fi: real tokens (tokens.ts), simplified content, phone frames 390x844.
Run: python3 gen.py  (writes *.dc.html and canvas.json beside this file)."""
import json, os, textwrap
HERE = os.path.dirname(os.path.abspath(__file__))

# tokens.ts (light) — lifted, not rounded
C = dict(bg="#F7F4EE", surface="#FFFFFF", surface2="#F1EDE4", sep="#E7E1D6", ink="#0E2233", ink2="#5B6B78",
         ink3="#8A98A4", amber="#F2A93B", amberDeep="#D98F1F", amberTint="#FBEBD0", green="#1F9D6A",
         greenTint="#DDF3E9", red="#D64545", redTint="#FBE3E3", navy="#0D2A3D", onNavy="#F3F6F8", navy2="#A7B4BF")
W, H = 390, 844
FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Nastaliq+Urdu:wght@400;600&display=swap">'
BASE_CSS = f"""
body{{margin:0;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:{C['ink']};-webkit-font-smoothing:antialiased}}
a{{color:{C['amberDeep']}}} a:hover{{color:{C['amber']}}}
.ur{{font-family:'Noto Nastaliq Urdu',serif;direction:rtl;line-height:1.9}}
.money{{font-variant-numeric:tabular-nums}}
"""

def svg(path, size=22, stroke=C['ink'], sw=2):
    return f'<svg viewBox="0 0 24 24" style="width:{size}px;height:{size}px;stroke:{stroke};stroke-width:{sw};fill:none;stroke-linecap:round;stroke-linejoin:round">{path}</svg>'
I = dict(
    send='<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', bolt='<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    wallet='<rect x="2" y="6" width="20" height="13" rx="3"/><path d="M16 12h4"/>', phone='<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    doc='<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h6"/>', mic='<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    back='<path d="M15 18l-6-6 6-6"/>', chev='<path d="M9 6l6 6-6 6"/>', check='<path d="M20 6 9 17l-5-5"/>', shield='<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
    pig='<path d="M5 11a7 7 0 0 1 14 0v3a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z"/><path d="M8 17v3M16 17v3M19 9h3"/>', card='<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/>',
    users='<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M21 20a6 6 0 0 0-5-6"/>', qr='<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM19 14h2M14 19h2M19 19h2"/>',
    gear='<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.8-1L14.5 3h-5l-.3 2.5a7 7 0 0 0-1.8 1l-2.3-1-2 3.5 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.8 1l.3 2.5h5l.3-2.5a7 7 0 0 0 1.8-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z"/>',
    globe='<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', lock='<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    x='<path d="M18 6 6 18M6 6l12 12"/>', clock='<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', search='<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    arrowdown='<path d="M12 4v16M5 13l7 7 7-7"/>', bell='<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/>', eye='<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
)

def wrap(name, body, extra_css="", height=None):
    H_ = height or H
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  {FONT}
  <style>{BASE_CSS}{extra_css}</style>
</helmet>
<div style="width:{W}px;height:{H_}px;background:{C['bg']};position:relative;overflow:hidden;border-radius:0">
{body}
</div>
</x-dc>
<script data-dc-script data-props='{{"$preview":{{"width":{W},"height":{H_}}}}}'>
class Component extends DCLogic {{}}
</script>
</body>
</html>
"""

# ---------- shared pieces ----------
def tabbar(active="Home"):
    items = [("Home", I['mic']), ("Wallet", I['wallet']), ("Pay", I['send']), ("More", '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>')]
    cells = ""
    for label, ic in items:
        col = C['amberDeep'] if label == active else C['ink3']
        cells += f'<div style="display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;font-weight:600;color:{col};min-width:64px">{svg(ic,22,col)}<span>{label}</span></div>'
    return f'<div style="position:absolute;left:0;right:0;bottom:0;height:84px;background:{C["surface"]};border-top:1px solid {C["sep"]};display:flex;justify-content:space-around;align-items:flex-start;padding:10px 12px 0">{cells}</div>'

def mic_fab(x=302, y=636, listening=False):
    ring = f'<div style="position:absolute;inset:-14px;border-radius:50%;border:2px solid {C["amber"]};opacity:.35"></div><div style="position:absolute;inset:-28px;border-radius:50%;border:2px solid {C["amber"]};opacity:.15"></div>' if listening else ""
    return f'<div style="position:absolute;left:{x}px;top:{y}px;width:64px;height:64px;border-radius:32px;background:{C["amber"]};display:flex;align-items:center;justify-content:center;box-shadow:0 8px 20px rgba(242,169,59,.45)">{ring}{svg(I["mic"],28,C["navy"],2.4)}</div>'

def navy_head(name="Ammi Jaan", greet="Good morning", balance="₨84,500", status=None, height=330, urdu=False):
    g_ur = '<div class="ur" style="font-size:16px;color:#A7B4BF;margin-top:-4px">السلام علیکم امی! آج کیا کرنا ہے؟</div>' if urdu else ""
    line = f'''<div style="font-size:26px;font-weight:800;line-height:1.15;letter-spacing:-.01em;color:{C['onNavy']};text-wrap:balance">Assalam o Alaikum, Ammi.<br>What shall we do?</div>{g_ur}'''
    st = ""
    if status == "listening":
        bars = "".join(f'<div style="width:3px;height:{h}px;border-radius:2px;background:{C["amber"]}"></div>' for h in [6,12,20,10,16,22,8,14,18,6,12,9])
        st = f'<div style="display:flex;align-items:center;gap:12px;color:{C["onNavy"]};font-size:14px;font-weight:600"><div style="display:flex;align-items:flex-end;gap:3px;height:22px">{bars}</div>Listening…</div>'
    elif status == "thinking":
        st = f'<div style="display:flex;align-items:center;gap:8px;color:{C["navy2"]};font-size:14px;font-weight:600"><span style="width:6px;height:6px;border-radius:3px;background:{C["amber"]}"></span><span style="width:6px;height:6px;border-radius:3px;background:{C["amber"]};opacity:.6"></span><span style="width:6px;height:6px;border-radius:3px;background:{C["amber"]};opacity:.3"></span>Thinking…</div>'
    elif status == "speaking":
        st = f'<div style="display:flex;align-items:center;gap:10px;color:{C["onNavy"]};font-size:14px;font-weight:600">{svg(I["mic"],16,C["amber"])}Speaking… <span style="color:{C["navy2"]};font-weight:500">tap to interrupt</span></div>'
    bal = f'<div style="display:flex;align-items:baseline;gap:8px"><span class="money" style="font-size:22px;font-weight:800;color:{C["onNavy"]}">{balance}</span><span style="font-size:12px;color:{C["navy2"]}">available</span></div>' if balance else ""
    return f'''<div style="position:absolute;left:0;right:0;top:0;height:{height}px;background:{C['navy']};padding:56px 20px 0;display:flex;flex-direction:column;gap:14px">
  <div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:18px;background:{C['amberTint']};color:{C['navy']};font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center">AJ</div><div><div style="font-size:12px;color:{C['navy2']}">{greet}</div><div style="font-size:15px;font-weight:700;color:{C['onNavy']}">{name}</div></div><div style="margin-left:auto">{svg(I['bell'],20,C['navy2'])}</div></div>
  {line}
  {bal}
  {st}
</div>'''

def sheet(top, inner, radius=28):
    return f'<div style="position:absolute;left:0;right:0;top:{top}px;bottom:0;background:{C["bg"]};border-radius:{radius}px {radius}px 0 0;padding:14px 18px 212px;display:flex;flex-direction:column;gap:10px"><div style="width:36px;height:4px;border-radius:2px;background:{C["sep"]};margin:0 auto 2px"></div>{inner}</div>'

def cap(t): return f'<div style="font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:{C["ink3"]};margin-top:4px">{t}</div>'
def card(inner, pad="12px 14px", bg=None, radius=20, extra=""):
    return f'<div style="background:{bg or C["surface"]};border-radius:{radius}px;padding:{pad};box-shadow:0 1px 2px rgba(14,34,51,.05),0 8px 24px rgba(14,34,51,.06);{extra}">{inner}</div>'
def row(icon, title, sub=None, right=None, tint=None, chevron=True):
    ic = f'<div style="width:40px;height:40px;border-radius:12px;background:{tint or C["amberTint"]};display:flex;align-items:center;justify-content:center;flex:none">{svg(icon,20,C["navy"])}</div>'
    s = f'<div style="font-size:13px;color:{C["ink2"]}">{sub}</div>' if sub else ""
    r = f'<div class="money" style="margin-left:auto;font-weight:700;font-size:15px">{right}</div>' if right else (f'<div style="margin-left:auto">{svg(I["chev"],18,C["ink3"])}</div>' if chevron else "")
    return f'<div style="display:flex;align-items:center;gap:12px;min-height:44px">{ic}<div><div style="font-size:15px;font-weight:600;line-height:1.25">{title}</div>{s}</div>{r}</div>'
def suggestion(icon, title, sub): return card(row(icon, title, sub), pad="12px 14px", radius=18)
def button(label, kind="primary", w="100%"):
    bg, col = (C['amber'], C['navy']) if kind == "primary" else ((C['surface2'], C['ink']) if kind == "secondary" else (C['navy'], C['onNavy']))
    return f'<div style="height:56px;border-radius:28px;background:{bg};color:{col};font-weight:700;font-size:16px;display:flex;align-items:center;justify-content:center;width:{w}">{label}</div>'
def plain_header(title, back=True):
    b = f'<div style="width:44px;height:44px;display:flex;align-items:center">{svg(I["back"],22)}</div>' if back else ""
    return f'<div style="position:absolute;left:0;right:0;top:0;height:104px;padding:56px 20px 0;display:flex;align-items:center;gap:4px"><div>{b}</div><div style="font-size:22px;font-weight:700">{title}</div></div>'
def body_area(inner, top=112, gap=12): return f'<div style="position:absolute;left:20px;right:20px;top:{top}px;bottom:100px;display:flex;flex-direction:column;gap:{gap}px">{inner}</div>'
def keypad(y=486, big=False):
    k = 64 if not big else 72; gap = 12
    keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"]
    cells = "".join(f'<div style="height:{k}px;border-radius:20px;background:{C["surface"] if kk else "transparent"};display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:600;box-shadow:{"0 1px 2px rgba(14,34,51,.05)" if kk else "none"}">{kk}</div>' for kk in keys)
    return f'<div style="position:absolute;left:20px;right:20px;top:{y}px;display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:{gap}px">{cells}</div>'
def pin_dots(): return f'<div style="display:flex;gap:16px;justify-content:center">' + "".join(f'<div style="width:16px;height:16px;border-radius:8px;border:2px solid {C["ink3"]}"></div>' for _ in range(4)) + '</div>'
def logo(initials, color="#0D2A3D", bg="#F1EDE4", size=36): return f'<div style="width:{size}px;height:{size}px;border-radius:{size//2}px;background:{bg};color:{color};font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex:none">{initials}</div>'
def bubble_user(t): return f'<div style="align-self:flex-end;max-width:78%;background:{C["navy"]};color:{C["onNavy"]};border-radius:20px 20px 4px 20px;padding:10px 14px;font-size:15px">{t}</div>'
def chatcard(inner): return f'<div style="align-self:flex-start;width:86%;">{card(inner, pad="14px")}</div>'

boards = {}

# ---------- Auth ----------
boards["Phone"] = wrap("Phone", f'''
<div style="position:absolute;left:20px;right:20px;top:64px;display:flex;flex-direction:column;gap:14px">
  <div style="display:flex;align-items:center;gap:10px"><div style="width:40px;height:40px;border-radius:12px;background:{C['amberTint']};display:flex;align-items:center;justify-content:center">{svg(I['wallet'],22,C['navy'])}</div><div style="font-size:22px;font-weight:800">PAYO</div></div>
  <div style="font-size:28px;font-weight:800;line-height:34px;letter-spacing:-.01em;margin-top:8px">Enter your mobile number</div>
  <div style="font-size:15px;color:{C['ink2']}">We'll send a code to verify it. New to PAYO? Your account is created automatically.</div>
  <div style="height:56px;border-radius:16px;border:2px solid {C['amber']};background:{C['surface']};display:flex;align-items:center;padding:0 16px;gap:12px;font-size:17px"><span style="font-weight:700">PK +92</span><span style="color:{C['ink3']}">300 000 0000</span></div>
</div>
{keypad(y=340)}
<div style="position:absolute;left:20px;right:20px;top:668px">{button("Send code")}</div>
<div style="position:absolute;left:20px;right:20px;top:740px;text-align:center;font-size:12px;color:{C['ink3']}">By continuing you agree to PAYO's terms.</div>
''')
boards["Otp"] = wrap("Otp", f'''
{plain_header("")}
<div style="position:absolute;left:20px;right:20px;top:110px;display:flex;flex-direction:column;gap:12px">
  <div style="font-size:28px;font-weight:800;line-height:34px">Enter the 6-digit code</div>
  <div style="font-size:15px;color:{C['ink2']}">Sent by SMS to +92 300 111 0001 · <a>Change</a></div>
  <div style="display:grid;grid-template-columns:repeat(6, minmax(0, 1fr));gap:8px;margin-top:8px">{"".join(f'<div style="height:56px;border-radius:14px;background:{C["surface"]};box-shadow:0 1px 2px rgba(14,34,51,.06)"></div>' for _ in range(6))}</div>
  <div style="background:{C['amberTint']};border-radius:14px;padding:12px 14px;font-size:14px;display:flex;gap:10px;align-items:center">{svg(I['bolt'],16,C['amberDeep'])}Demo build: your code is <b>376382</b></div>
</div>
{keypad(y=356)}
<div style="position:absolute;left:20px;right:20px;top:690px">{button("Verify")}</div>
''')
boards["Pin"] = wrap("Pin", f'''
<div style="position:absolute;left:20px;right:20px;top:120px;display:flex;flex-direction:column;align-items:center;gap:12px">
  <div style="width:64px;height:64px;border-radius:32px;background:{C['amberTint']};display:flex;align-items:center;justify-content:center;font-weight:800;color:{C['navy']}">AJ</div>
  <div style="font-size:28px;font-weight:800;line-height:34px;text-align:center">Welcome back, Ammi</div>
  <div style="font-size:15px;color:{C['ink2']}">Enter your PIN to open your wallet</div>
  <div style="margin-top:10px">{pin_dots()}</div>
</div>
{keypad(y=380, big=True)}
<div style="position:absolute;left:20px;right:20px;top:760px;text-align:center;font-size:13px;color:{C['ink3']}">Forgot PIN? · Not you?</div>
''')

# ---------- Home states ----------
home_sheet = (cap("Since you were last here") +
    card(row(I['bolt'], "K-Electric bill is due", "Due 10 Sep", right="₨4,320")) +
    card(row(I['arrowdown'], "Sara Khan paid you", "Yesterday", right=f'<span style="color:{C["green"]}">+₨2,000</span>', tint=C['greenTint'])) +
    cap("Say it, or tap") +
    suggestion(I['send'], "Send money", "To a contact or a bank") +
    suggestion(I['bolt'], "Pay a bill", "K-Electric ₨4,320 is due"))
boards["Main"] = wrap("Main", navy_head(status=None) + sheet(316, home_sheet) + mic_fab(listening=False) + tabbar("Home"))
boards["HomeListening"] = wrap("HomeListening", navy_head(status="listening", height=350) + sheet(336, cap("Heard so far") + card(f'<div style="font-size:17px;line-height:24px">"Send two hundred and fifty rupees to <b>Munsif</b>…"</div>')) + mic_fab(listening=True) + tabbar("Home"))
conv = f'''<div style="display:flex;flex-direction:column;gap:10px">
{bubble_user("Send 250 to Munsif")}
{chatcard(f'<div style="display:flex;align-items:center;gap:12px">{logo("MK", bg=C["amberTint"])}<div><div style="font-size:16px;font-weight:700">Munsif Khan</div><div style="font-size:13px;color:{C["ink2"]}">Easypaisa · +92••••••810</div></div></div><div style="font-size:14px;color:{C["ink2"]};margin:10px 0 8px">Send to Munsif?</div><div style="display:flex;gap:8px"><div style="height:44px;border-radius:22px;background:{C["amber"]};color:{C["navy"]};font-weight:700;padding:0 16px;display:flex;align-items:center">Yes, continue</div><div style="height:44px;border-radius:22px;background:{C["surface2"]};font-weight:600;padding:0 16px;display:flex;align-items:center">No</div></div>')}
{bubble_user("Yes")}
{chatcard(f'<div style="text-align:center"><div style="font-size:13px;color:{C["ink2"]}">Send ₨250 to Munsif</div><div class="money" style="font-size:32px;font-weight:800;margin:6px 0 2px">₨250</div><div style="font-size:12px;color:{C["ink3"]}">Fee ₨0 · Total ₨250</div><div style="margin-top:10px">{button("Confirm with PIN")}</div></div>')}
</div>'''
boards["HomeConversation"] = wrap("HomeConversation", navy_head(status="speaking", height=230, balance=None) + sheet(216, conv) + mic_fab(listening=True) + tabbar("Home"))
pinsheet = f'''<div style="position:absolute;left:0;right:0;top:0;bottom:0;background:rgba(13,42,61,.45)"></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:560px;background:{C['bg']};border-radius:28px 28px 0 0;padding:14px 20px 0;display:flex;flex-direction:column;align-items:center;gap:10px">
  <div style="width:36px;height:4px;border-radius:2px;background:{C['sep']}"></div>
  <div style="width:56px;height:56px;border-radius:28px;background:{C['amberTint']};display:flex;align-items:center;justify-content:center;margin-top:6px">{svg(I['lock'],24,C['navy'])}</div>
  <div style="font-size:22px;font-weight:800">Enter your PIN</div>
  <div style="font-size:14px;color:{C['ink2']}">Send ₨250 to Munsif</div>
  <div style="margin:6px 0 4px">{pin_dots()}</div>
</div>
{keypad(y=470, big=True)}
<div style="position:absolute;left:0;right:0;bottom:22px;text-align:center;font-size:14px;color:{C['ink2']}">Cancel</div>'''
boards["HomePinSheet"] = wrap("HomePinSheet", navy_head(status="speaking", height=230, balance=None) + sheet(216, conv) + tabbar("Home") + pinsheet)
boards["HomeUrdu"] = wrap("HomeUrdu", navy_head(name="امی", greet="صبح بخیر", status=None, urdu=True, height=350).replace("Assalam o Alaikum, Ammi.<br>What shall we do?", '<span class="ur" style="font-size:26px">السلام علیکم امی!</span>') + sheet(336,
    cap("پچھلی بار کے بعد").replace('margin-top:4px', 'margin-top:4px;text-align:right') +
    card(f'<div style="display:flex;align-items:center;gap:12px;flex-direction:row-reverse;text-align:right"><div style="width:40px;height:40px;border-radius:12px;background:{C["amberTint"]};display:flex;align-items:center;justify-content:center">{svg(I["bolt"],20,C["navy"])}</div><div class="ur" style="flex:1"><div style="font-size:15px;font-weight:600">کے الیکٹرک کا بل واجب الادا ہے</div><div style="font-size:13px;color:{C["ink2"]}">آخری تاریخ 10 ستمبر</div></div><div class="money" style="font-weight:700">₨4,320</div></div>') +
    card(f'<div class="ur" style="display:flex;align-items:center;gap:12px;flex-direction:row-reverse;text-align:right"><div style="width:40px;height:40px;border-radius:12px;background:{C["amberTint"]};display:flex;align-items:center;justify-content:center">{svg(I["send"],20,C["navy"])}</div><div style="flex:1"><div style="font-size:15px;font-weight:600">پیسے بھیجیں</div><div style="font-size:13px;color:{C["ink2"]}">کسی رابطے یا بینک اکاؤنٹ کو</div></div></div>', radius=18)) + mic_fab() + tabbar("Home"))

# ---------- Cards sheet (component artboard) ----------
receipt = card(f'<div style="text-align:center">{logo("PT", bg=C["amberTint"], size=44)}<div style="font-size:15px;font-weight:600;margin-top:8px">Sent to PTCL</div><div class="money" style="font-size:28px;font-weight:800;color:{C["red"]}">−₨2,550</div><div style="display:inline-flex;gap:6px;align-items:center;background:{C["greenTint"]};color:{C["green"]};border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;margin-top:6px">{svg(I["check"],12,C["green"])}Completed</div><div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:6px;text-align:left;margin-top:12px;font-size:13px"><span style="color:{C["ink2"]}">Date</span><span style="text-align:right">4 Sep, 18:43</span><span style="color:{C["ink2"]}">Reference</span><span style="text-align:right">PAYO-GGYCPAREXE</span></div></div>')
spend = card(f'<div style="font-size:12px;color:{C["ink3"]};font-weight:600;letter-spacing:.08em">AUGUST 2026 · MONEY OUT</div><div class="money" style="font-size:30px;font-weight:800">₨180,967</div>' + "".join(f'<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:14px"><span>{n}</span><span class="money" style="font-weight:600">{v}</span></div><div style="height:6px;border-radius:3px;background:{C["surface2"]};margin-top:4px"><div style="height:6px;border-radius:3px;background:{C["amber"]};width:{w}%"></div></div></div>' for n,v,w in [("Transfers","₨142,928",79),("Bills","₨21,105",12),("Shopping","₨6,664",4)]) + f'<div style="margin-top:10px;font-size:13px;color:{C["red"]};font-weight:600">↗ ₨141,356 more than July</div>')
checkin = card(f'<div style="text-align:center"><div style="width:44px;height:44px;border-radius:22px;background:{C["amberTint"]};display:inline-flex;align-items:center;justify-content:center">{svg(I["shield"],22,C["amberDeep"])}</div><div style="font-size:17px;font-weight:700;line-height:22px;margin:8px 0 4px">Did someone call or message you and ask you to send this?</div><div style="display:inline-block;background:{C["amberTint"]};color:{C["amberDeep"]};font-size:12px;font-weight:600;border-radius:999px;padding:3px 10px">Large payment to someone new</div><div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">{button("Yes, someone asked me")}{button("No, this is my own idea","secondary")}</div></div>')
waiting = card(f'<div style="text-align:center"><div style="width:44px;height:44px;border-radius:22px;background:{C["amberTint"]};display:inline-flex;align-items:center;justify-content:center">{svg(I["clock"],22,C["amberDeep"])}</div><div style="font-size:15px;font-weight:600;margin-top:8px">Send ₨30,000 to Sara Khan</div><div class="money" style="font-size:28px;font-weight:800">₨30,000</div><div style="font-size:14px;color:{C["ink2"]};margin:6px 0">Bilal has to approve this before it can be sent.</div><div style="font-size:12px;color:{C["ink3"]}">Expires in 29:36</div><div style="margin-top:10px">{button("Remind Bilal","secondary")}</div></div>')
approvals = card(f'{cap("Waiting for your approval")}<div style="display:flex;align-items:center;gap:10px;margin-top:8px">{logo("AJ", bg=C["amberTint"])}<div><div style="font-size:15px;font-weight:700">Ammi Jaan</div><div style="font-size:13px;color:{C["ink2"]}">Send ₨30,000 to Sara Khan</div></div><div class="money" style="margin-left:auto;font-weight:800">₨30,000</div></div><div style="display:inline-block;background:{C["amberTint"]};color:{C["amberDeep"]};font-size:12px;font-weight:600;border-radius:999px;padding:3px 10px;margin-top:8px">Large payment to someone new</div><div style="margin-top:10px;display:flex;flex-direction:column;gap:8px">{button("Approve with my PIN")}{button("Decline","secondary")}</div>')
helpc = card(cap("Things you can say") + "".join(f'<div style="display:flex;align-items:center;justify-content:space-between;min-height:44px;border-bottom:1px solid {C["sep"]};font-size:15px;font-weight:600">{t}{svg(I["chev"],18,C["ink3"])}</div>' for t in ["My balance","Send money","Pay a bill","My card","Freeze my card","Money requests","Switch language"]))
boards["Cards"] = wrap("Cards", f'''
<div style="position:absolute;left:20px;right:20px;top:24px;display:flex;flex-direction:column;gap:14px">
  <div style="font-size:12px;font-weight:600;letter-spacing:.1em;color:{C['amberDeep']}">CHAT CARDS · NO TEXT BUBBLE, THE SENTENCE IS SPOKEN</div>
  {receipt}{spend}{checkin}{waiting}{approvals}{helpc}
</div>''', height=1560)

# ---------- Classic screens ----------
boards["Wallet"] = wrap("Wallet", navy_head(greet="Available balance", balance="₨84,500", status=None, height=300).replace("Assalam o Alaikum, Ammi.<br>What shall we do?", f'<span style="font-size:14px;color:{C["navy2"]};font-weight:500">Ammi Jaan · PAYO wallet · PKR</span>') + f'''
<div style="position:absolute;left:20px;right:20px;top:196px;display:flex;gap:10px">{button("Send","primary","1fr").replace("width:1fr","flex:1")}{button("Request","secondary","1fr").replace("width:1fr","flex:1")}<div style="width:56px;height:56px;border-radius:28px;background:{C['surface2']};display:flex;align-items:center;justify-content:center">{svg(I['qr'],22)}</div></div>''' + sheet(286,
    f'<div style="display:grid;grid-template-columns:repeat(4, minmax(0, 1fr));gap:8px">' + "".join(f'<div style="background:{C["surface"]};border-radius:18px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11px;font-weight:600;box-shadow:0 1px 2px rgba(14,34,51,.05)">{svg(ic,22,C["navy"])}{t}</div>' for ic,t in [(I['send'],"Send"),(I['bolt'],"Bills"),(I['phone'],"Top-up"),(I['pig'],"Savings")]) + '</div>' +
    card(row(I['bolt'], "K-Electric bill due 10 Sep", "₨4,320 · Consumer ···5678", right=f'<span style="background:{C["amber"]};color:{C["navy"]};border-radius:999px;padding:6px 12px;font-size:12px">Pay</span>'), bg=C['amberTint']) +
    cap("Recent activity") + card(row(I['send'], "Meezan Savings", "Aug 28 · Transfer", right="−₨142,928", tint=C['surface2']) + f'<div style="height:1px;background:{C["sep"]};margin:8px 0"></div>' + row(I['phone'], "Jazz", "Aug 27 · Top-up", right="−₨283", tint=C['surface2']))) + tabbar("Wallet"))
tiles = "".join(f'<div style="background:{C["surface"]};border-radius:20px;padding:16px 14px;height:104px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 1px 2px rgba(14,34,51,.05),0 8px 24px rgba(14,34,51,.06)"><div style="width:40px;height:40px;border-radius:12px;background:{C["amberTint"]};display:flex;align-items:center;justify-content:center">{svg(ic,20,C["navy"])}</div><div style="font-size:15px;font-weight:700">{t}</div></div>' for ic,t in [(I['send'],"Send money"),(I['users'],"Saved recipients"),(I['qr'],"Scan QR"),(I['bolt'],"Pay bills"),(I['phone'],"Mobile top-up"),(I['arrowdown'],"Request money")])
boards["Pay"] = wrap("Pay", plain_header("Pay", back=False) + body_area(f'<div style="height:52px;border-radius:16px;background:{C["surface"]};display:flex;align-items:center;gap:10px;padding:0 14px;color:{C["ink3"]};font-size:15px;box-shadow:0 1px 2px rgba(14,34,51,.05)">{svg(I["search"],18,C["ink3"])}Search a recipient or biller</div><div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px">{tiles}</div>') + f'<div style="position:absolute;left:16px;right:16px;bottom:96px;height:56px;border-radius:28px;background:{C["navy"]};color:{C["onNavy"]};display:flex;align-items:center;gap:12px;padding:0 8px 0 6px"><div style="width:44px;height:44px;border-radius:22px;background:{C["amber"]};display:flex;align-items:center;justify-content:center">{svg(I["mic"],20,C["navy"])}</div><span style="font-size:15px;font-weight:600">Ask PAYO — say or type…</span></div>' + tabbar("Pay"))
boards["SendIdentifier"] = wrap("SendIdentifier", plain_header("Send money") + body_area(f'<div style="height:56px;border-radius:16px;background:{C["surface"]};display:flex;align-items:center;padding:0 16px;color:{C["ink3"]};font-size:16px;border:2px solid {C["amber"]}">IBAN, phone, or account number</div>{button("Continue")}{cap("Saved recipients")}' + card(row(I['users'], "Munsif Khan", "Easypaisa · +92••••••810", chevron=True) + f'<div style="height:1px;background:{C["sep"]};margin:8px 0"></div>' + row(I['users'], "Sara Khan", "PAYO · +92••••••003"))))
inst = "".join(f'<div style="display:flex;align-items:center;gap:12px;min-height:56px;border-bottom:1px solid {C["sep"]}">{logo(ab, color=col, bg=bg)}<div style="font-size:16px;font-weight:600">{n}</div><div style="margin-left:auto">{svg(I["chev"],18,C["ink3"])}</div></div>' for ab,n,col,bg in [("P","PAYO",C['navy'],C['amberTint']),("EP","Easypaisa","#1B7F3B","#DDF3E9"),("JC","JazzCash","#B11F27","#FBE3E3"),("HBL","HBL","#0B6B3A","#DDF3E9"),("MB","Meezan Bank","#4B2E83","#EEE9F7"),("UBL","UBL","#0E2233","#F1EDE4")])
boards["SendInstitution"] = wrap("SendInstitution", plain_header("Choose bank or wallet") + body_area(f'<div style="height:52px;border-radius:16px;background:{C["surface"]};display:flex;align-items:center;gap:10px;padding:0 14px;color:{C["ink3"]};font-size:15px">{svg(I["search"],18,C["ink3"])}Search banks and wallets</div>{cap("Popular")}<div style="display:flex;flex-direction:column">{inst}</div>'))
boards["SendAmount"] = wrap("SendAmount", plain_header("Amount") + f'''<div style="position:absolute;left:20px;right:20px;top:112px;display:flex;flex-direction:column;align-items:center;gap:8px">{card(f'<div style="display:flex;align-items:center;gap:12px">{logo("MK", bg=C["amberTint"])}<div><div style="font-size:15px;font-weight:700">Munsif Khan</div><div style="font-size:13px;color:{C["ink2"]}">Easypaisa · +92••••••810</div></div></div>', extra="width:100%;box-sizing:border-box")}<div class="money" style="font-size:48px;font-weight:800;margin-top:14px">₨250</div><div style="font-size:13px;color:{C['ink3']}">Fee ₨0 · Available ₨84,500</div></div>''' + keypad(y=372) + f'<div style="position:absolute;left:20px;right:20px;top:700px">{button("Continue")}</div>')
boards["Success"] = wrap("Success", f'''<div style="position:absolute;left:20px;right:20px;top:150px;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center">
  <div style="width:88px;height:88px;border-radius:44px;background:{C['greenTint']};display:flex;align-items:center;justify-content:center">{svg(I['check'],40,C['green'],2.6)}</div>
  <div style="font-size:26px;font-weight:800;margin-top:6px">Sent</div>
  <div class="money" style="font-size:40px;font-weight:800">₨250</div>
  <div style="font-size:15px;color:{C['ink2']}">to Munsif Khan · Easypaisa</div>
  <div style="font-size:12px;color:{C['ink3']};background:{C['surface2']};border-radius:999px;padding:4px 10px">PAYO-9N546BBCQK</div>
  <div style="font-size:13px;color:{C['ink2']};margin-top:6px">{svg(I['mic'],14,C['amberDeep'])} "Done. Two hundred and fifty rupees sent to Munsif."</div>
</div>
<div style="position:absolute;left:20px;right:20px;top:560px;display:flex;flex-direction:column;gap:10px">{card(row(I['users'], "Save Munsif as a recipient?", "Next time, just say the name", right=f'<div style="width:44px;height:26px;border-radius:13px;background:{C["amber"]}"></div>'))}{button("Done")}</div>''')

# ---------- More & others ----------
boards["Bills"] = wrap("Bills", plain_header("Bills") + body_area(card(row(I['bolt'], "K-Electric", "Due 10 Sep · ₨4,320", right=f'<span style="background:{C["amber"]};color:{C["navy"]};border-radius:999px;padding:6px 12px;font-size:12px;font-weight:700">Pay</span>'), bg=C['amberTint']) + cap("Saved") + card(row(I['doc'], "PTCL · Hina Shahid", "0400012345678")) + cap("Electricity") + card(row(I['bolt'], "K-Electric") + f'<div style="height:1px;background:{C["sep"]};margin:8px 0"></div>' + row(I['bolt'], "LESCO")) + cap("Mobile") + card(row(I['phone'], "Jazz") + f'<div style="height:1px;background:{C["sep"]};margin:8px 0"></div>' + row(I['phone'], "Zong"))))
boards["Card"] = wrap("Card", plain_header("My card") + body_area(f'''<div style="border-radius:20px;background:linear-gradient(135deg,{C['navy']},#1A3B52);color:{C['onNavy']};padding:20px;height:190px;display:flex;flex-direction:column;justify-content:space-between"><div style="display:flex;justify-content:space-between;font-weight:800">PAYO<span style="font-size:11px;background:rgba(255,255,255,.15);border-radius:999px;padding:3px 8px">Virtual</span></div><div class="money" style="font-size:20px;letter-spacing:.12em">•••• •••• •••• 9405</div><div style="display:flex;justify-content:space-between;font-size:12px"><span>AMMI JAAN</span><span>09/29</span></div></div>
<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">''' + "".join(f'<div style="background:{C["surface"]};border-radius:18px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;font-weight:600;min-height:70px;box-shadow:0 1px 2px rgba(14,34,51,.05)">{svg(ic,22,C["navy"])}{t}</div>' for ic,t in [(I['eye'],"Show number"),(I['lock'],"Freeze card"),(I['gear'],"Limits")]) + '</div>' + card(row(I['shield'], "Card is active", "Online payments enabled", right=f'<div style="width:44px;height:26px;border-radius:13px;background:{C["green"]}"></div>', tint=C['greenTint'])) + cap("Card activity") + card(row(I['send'], "Meezan Savings", "Aug 28", right="−₨142,928", tint=C['surface2']))))
boards["Pockets"] = wrap("Pockets", plain_header("Savings") + body_area(f'<div style="border-radius:20px;background:{C["navy"]};color:{C["onNavy"]};padding:20px"><div style="font-size:12px;color:{C["navy2"]};letter-spacing:.08em;font-weight:600">TOTAL SAVED</div><div class="money" style="font-size:36px;font-weight:800">₨120,000</div><div style="font-size:13px;color:{C["navy2"]}">across 1 pocket</div></div>' + card(f'<div style="display:flex;align-items:center;gap:12px"><div style="width:44px;height:44px;border-radius:14px;background:{C["amberTint"]};display:flex;align-items:center;justify-content:center">{svg(I["pig"],22,C["navy"])}</div><div style="flex:1"><div style="font-size:16px;font-weight:700">Umrah Fund</div><div style="font-size:13px;color:{C["ink2"]}">₨120,000 of ₨500,000</div><div style="height:6px;border-radius:3px;background:{C["surface2"]};margin-top:8px"><div style="height:6px;border-radius:3px;background:{C["amber"]};width:24%"></div></div></div></div><div style="display:flex;gap:8px;margin-top:12px"><div style="flex:1">{button("Add money")}</div><div style="flex:1">{button("Withdraw","secondary")}</div></div>') + button("New pocket","tertiary")))
boards["Requests"] = wrap("Requests", plain_header("Requests") + f'<div style="position:absolute;right:20px;top:64px;height:36px;border-radius:18px;background:{C["amber"]};color:{C["navy"]};font-weight:700;font-size:13px;display:flex;align-items:center;padding:0 14px">+ Request money</div>' + body_area(approvals + cap("Incoming") + card(row(I['users'], "Bilal Ahmed asks for ₨1,500", "lunch · 2h ago", right="₨1,500")) + cap("Outgoing") + card(row(I['send'], "You asked Sara for ₨2,000", "Pending", right="₨2,000", tint=C['surface2']))))
boards["Settings"] = wrap("Settings", plain_header("Settings") + body_area(card(row(I['shield'], "Trusted contact", "Bilal Ahmed · +92••••••002", chevron=False) + f'<div style="display:flex;gap:8px;margin-top:12px"><div style="flex:1">{button("Change","secondary")}</div><div style="flex:1;height:56px;border-radius:28px;background:{C["redTint"]};color:{C["red"]};font-weight:700;display:flex;align-items:center;justify-content:center">Remove</div></div>') + card(row(I['wallet'], "Approval limit", "₨100,000 or more — or ₨20,000+ to someone new — needs Bilal's approval", chevron=False) + f'<div style="margin-top:12px">{button("Change limit","secondary")}</div>') + card(row(I['mic'], "PAYO speaks first", "Hear what changed when you open the app", right=f'<div style="width:44px;height:26px;border-radius:13px;background:{C["amber"]}"></div>')) + card(row(I['users'], "Age-based protection", "Ammi is 65 · extra check on large sends to someone new", chevron=False, tint=C['surface2']))))
more_rows = [(I['pig'],"Savings","1 pocket · ₨120,000"),(I['card'],"My card","Virtual · active"),(I['doc'],"Statements",None),(I['users'],"Requests",None)]
more2 = [(I['globe'],"Language","English"),(I['gear'],"Settings","Trusted contact, limits, greeting"),(I['lock'],"Security & PIN",None)]
def group(rows): return card("".join(row(ic,t,s) + (f'<div style="height:1px;background:{C["sep"]};margin:8px 0"></div>' if i < len(rows)-1 else "") for i,(ic,t,s) in enumerate(rows)))
boards["More"] = wrap("More", plain_header("More", back=False) + body_area(card(f'<div style="display:flex;align-items:center;gap:12px"><div style="width:48px;height:48px;border-radius:24px;background:{C["amberTint"]};display:flex;align-items:center;justify-content:center;font-weight:800;color:{C["navy"]}">AJ</div><div><div style="font-size:17px;font-weight:700">Ammi Jaan</div><div style="font-size:13px;color:{C["ink2"]}">+92 300 111 0001</div></div></div>') + group(more_rows) + group(more2)) + tabbar("More"))

# ---------- write ----------
for name, html in boards.items():
    with open(os.path.join(HERE, f"{name}.dc.html"), "w") as f: f.write(html)

rows = [
    ("Sign in", ["Phone","Otp","Pin"]),
    ("Home — AI first (Direction B + A greeting)", ["Main","HomeListening","HomeConversation","HomePinSheet","HomeUrdu"]),
    ("Chat cards", ["Cards"]),
    ("Classic layer", ["Wallet","Pay","SendIdentifier","SendInstitution","SendAmount","Success"]),
    ("More", ["Bills","Card","Pockets","Requests","Settings","More"]),
]
arts, notes, y = [], [], 0
for label, names in rows:
    notes.append({"id": "note-" + label.split()[0].lower().replace("—",""), "x": 0, "y": y - 70, "w": 420, "text": label})
    for i, n in enumerate(names):
        h = 1560 if n == "Cards" else H
        arts.append({"file": f"{n}.dc.html", "x": i * (W + 90), "y": y, "w": W, "h": h, "title": n})
    y += (1560 if names == ["Cards"] else H) + 170
canvas = {"artboards": arts, "annotations": notes, "launch": {"view": "canvas"}}
with open(os.path.join(HERE, "canvas.json"), "w") as f: json.dump(canvas, f, indent=1)
print(f"wrote {len(boards)} artboards + canvas.json")
