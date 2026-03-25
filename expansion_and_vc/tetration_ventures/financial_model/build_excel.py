from openpyxl import Workbook
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.chart.series import DataPoint

# ── Colour palette ─────────────────────────────────────────
NAVY       = "1D4ED8"   # primary blue
NAVY_DARK  = "1E3A8A"   # darker blue
AMBER      = "F59E0B"   # accent amber
AMBER_DARK = "92400E"
SLATE      = "0F172A"   # near-black
SLATE_MID  = "334155"
WHITE      = "FFFFFF"
BG_BLUE    = "EFF6FF"   # very light blue
BG_AMBER   = "FFFBEB"   # very light amber
BG_GREEN   = "ECFDF5"
GREEN      = "10B981"
RED        = "EF4444"
GREY_LIGHT = "F1F5F9"
GREY_BORDER= "CBD5E1"
DARK_TEXT  = "0F172A"
MUTED_TEXT = "64748B"

def fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def font(bold=False, color=DARK_TEXT, size=10, italic=False):
    return Font(bold=bold, color=color, size=size, italic=italic, name="Calibri")

def border(style="thin", color=GREY_BORDER):
    s = Side(style=style, color=color)
    return Border(left=s, right=s, top=s, bottom=s)

def align(h="left", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

wb = Workbook()

# ════════════════════════════════════════════════════════════
# SHEET 1: DASHBOARD
# ════════════════════════════════════════════════════════════
ws1 = wb.active
ws1.title = "📊 Dashboard"
ws1.sheet_view.showGridLines = False
ws1.column_dimensions["A"].width = 32
ws1.column_dimensions["B"].width = 22
ws1.column_dimensions["C"].width = 22
ws1.column_dimensions["D"].width = 22
ws1.column_dimensions["E"].width = 22
ws1.column_dimensions["F"].width = 20

# Header banner
ws1.merge_cells("A1:F1")
ws1["A1"] = "SchoolPuls Technologies Pvt Ltd — Financial Model"
ws1["A1"].fill = fill(SLATE)
ws1["A1"].font = Font(bold=True, color=WHITE, size=16, name="Calibri")
ws1["A1"].alignment = align("center")
ws1.row_dimensions[1].height = 36

ws1.merge_cells("A2:F2")
ws1["A2"] = "Seed Round 2026  |  All figures in Indian Rupees (₹)  |  Confidential"
ws1["A2"].fill = fill(NAVY)
ws1["A2"].font = Font(color=WHITE, size=10, italic=True, name="Calibri")
ws1["A2"].alignment = align("center")
ws1.row_dimensions[2].height = 20

ws1.row_dimensions[3].height = 10

# ── KPI Cards row ──
def kpi_card(ws, row, col, label, value, sub, bg, val_color):
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+1)
    ws.merge_cells(start_row=row+1, start_column=col, end_row=row+1, end_column=col+1)
    ws.merge_cells(start_row=row+2, start_column=col, end_row=row+2, end_column=col+1)
    for r in [row, row+1, row+2]:
        for c in [col, col+1]:
            ws.cell(r, c).fill = fill(bg)
    ws.cell(row, col).value = label
    ws.cell(row, col).font = Font(size=9, color=MUTED_TEXT, name="Calibri", bold=True)
    ws.cell(row, col).alignment = align("center")
    ws.cell(row+1, col).value = value
    ws.cell(row+1, col).font = Font(bold=True, size=20, color=val_color, name="Calibri")
    ws.cell(row+1, col).alignment = align("center")
    ws.cell(row+2, col).value = sub
    ws.cell(row+2, col).font = Font(size=8, color=MUTED_TEXT, name="Calibri", italic=True)
    ws.cell(row+2, col).alignment = align("center")
    for r in [row, row+1, row+2]:
        ws.row_dimensions[r].height = 22

kpi_card(ws1, 4, 1, "SEED RAISE",        "₹2 Crore",        "~USD 240,000",            BG_BLUE,  NAVY)
kpi_card(ws1, 4, 3, "PRE-MONEY VAL",     "₹10 Crore",       "17% dilution",            BG_AMBER, AMBER_DARK)
kpi_card(ws1, 4, 5, "MONTH 12 ARR",      "₹1.5 Crore",      "100 schools target",      BG_GREEN, GREEN)

ws1.row_dimensions[7].height = 10

kpi_card(ws1, 8, 1, "LTV : CAC",         "50x",             "Payback in 6 weeks",      GREY_LIGHT, NAVY)
kpi_card(ws1, 8, 3, "GROSS MARGIN",      "~90%",            "Infra cost <10% revenue", GREY_LIGHT, GREEN)
kpi_card(ws1, 8, 5, "CASH FLOW +VE",     "Month 9",         "Base case",               GREY_LIGHT, AMBER_DARK)

ws1.row_dimensions[11].height = 10

# ── 3-Year Summary table ──
ws1.merge_cells("A12:F12")
ws1["A12"] = "3-YEAR FINANCIAL SUMMARY"
ws1["A12"].fill = fill(NAVY_DARK)
ws1["A12"].font = Font(bold=True, color=WHITE, size=11, name="Calibri")
ws1["A12"].alignment = align("center")
ws1.row_dimensions[12].height = 24

headers13 = ["Metric", "Year 1 (Seed)", "Year 2", "Year 3", ""]
for i, h in enumerate(headers13, 1):
    c = ws1.cell(13, i)
    c.value = h
    c.fill = fill(SLATE_MID)
    c.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    c.alignment = align("center")
ws1.row_dimensions[13].height = 20

summary_data = [
    ("Schools (end of year)",     "100",         "600",            "1,200"),
    ("ARR (₹)",                   "1,50,00,000", "9,00,00,000",    "18,00,00,000"),
    ("Annual Revenue (₹)",        "9,38,000",    "5,19,37,500",    "18,00,00,000"),
    ("Monthly Burn (₹)",          "4,50,000",    "~8,00,000",      "~20,00,000"),
    ("Annual Burn (₹)",           "54,00,000",   "1,20,00,000",    "2,50,00,000"),
    ("Closing Cash (₹)",          "1,90,62,000", "5,89,99,500",    "21,39,99,500"),
    ("Cash Flow Positive From",   "Month 9",     "Month 1",        "Month 1"),
]
row_fills = [BG_BLUE, WHITE, BG_BLUE, WHITE, BG_BLUE, WHITE, BG_BLUE]
for ri, (row_data, rfill) in enumerate(zip(summary_data, row_fills)):
    r = 14 + ri
    ws1.row_dimensions[r].height = 20
    ws1.cell(r, 1).value = row_data[0]
    ws1.cell(r, 1).font = Font(bold=True, size=10, name="Calibri", color=DARK_TEXT)
    ws1.cell(r, 1).fill = fill(rfill)
    ws1.cell(r, 1).alignment = align("left")
    for ci, val in enumerate(row_data[1:], 2):
        c = ws1.cell(r, ci)
        c.value = val
        c.font = Font(size=10, name="Calibri", color=DARK_TEXT)
        c.fill = fill(rfill)
        c.alignment = align("center")

ws1.row_dimensions[21].height = 10

# ── Scenarios ──
ws1.merge_cells("A22:F22")
ws1["A22"] = "REVENUE SCENARIOS — MONTH 12"
ws1["A22"].fill = fill(NAVY_DARK)
ws1["A22"].font = Font(bold=True, color=WHITE, size=11, name="Calibri")
ws1["A22"].alignment = align("center")
ws1.row_dimensions[22].height = 24

sc_headers = ["Scenario", "Schools (M12)", "Avg ARPU/mo (₹)", "MRR (₹)", "ARR (₹)", "Note"]
for i, h in enumerate(sc_headers, 1):
    c = ws1.cell(23, i)
    c.value = h
    c.fill = fill(SLATE_MID)
    c.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    c.alignment = align("center")
ws1.row_dimensions[23].height = 20

scenarios = [
    ("🐻 Bear Case",  "60",  "10,000", "6,00,000",  "7,20,00,000",  "Slow adoption",       "FFF1F2", RED),
    ("📈 Base Case",  "100", "12,500", "12,50,000", "15,00,00,000", "Current plan",        BG_BLUE,  NAVY),
    ("🚀 Bull Case",  "150", "14,000", "21,00,000", "25,20,00,000", "Strong referral loop", BG_GREEN, GREEN),
]
for ri, (sc, sch, arpu, mrr, arr, note, bg, vc) in enumerate(scenarios):
    r = 24 + ri
    ws1.row_dimensions[r].height = 22
    vals = [sc, sch, arpu, mrr, arr, note]
    for ci, v in enumerate(vals, 1):
        c = ws1.cell(r, ci)
        c.value = v
        c.fill = fill(bg)
        c.font = Font(size=10, name="Calibri", color=vc if ci == 1 else DARK_TEXT, bold=(ci==1))
        c.alignment = align("center")

# ════════════════════════════════════════════════════════════
# SHEET 2: YEAR 1 MONTHLY MODEL
# ════════════════════════════════════════════════════════════
ws2 = wb.create_sheet("📅 Year 1 Monthly")
ws2.sheet_view.showGridLines = False
ws2.column_dimensions["A"].width = 30
for col in range(2, 15):
    ws2.column_dimensions[get_column_letter(col)].width = 13
ws2.column_dimensions["N"].width = 16

# Header
ws2.merge_cells("A1:N1")
ws2["A1"] = "YEAR 1 — MONTHLY FINANCIAL MODEL (Post-Funding)"
ws2["A1"].fill = fill(SLATE)
ws2["A1"].font = Font(bold=True, color=WHITE, size=14, name="Calibri")
ws2["A1"].alignment = align("center")
ws2.row_dimensions[1].height = 32

ws2.merge_cells("A2:N2")
ws2["A2"] = "Funding: ₹2 Crore received Month 1  |  Monthly Burn: ₹4,50,000  |  Break-even: Month 9"
ws2["A2"].fill = fill(NAVY)
ws2["A2"].font = Font(color=WHITE, size=10, italic=True, name="Calibri")
ws2["A2"].alignment = align("center")
ws2.row_dimensions[2].height = 18

ws2.row_dimensions[3].height = 8

months = ["M1","M2","M3","M4","M5","M6","M7","M8","M9","M10","M11","M12","TOTAL"]
month_labels = ["Month 1","Month 2","Month 3","Month 4","Month 5","Month 6",
                "Month 7","Month 8","Month 9","Month 10","Month 11","Month 12","YEAR 1"]

# Month headers
ws2.cell(4, 1).value = ""
ws2.cell(4, 1).fill = fill(SLATE)
for i, m in enumerate(month_labels, 2):
    c = ws2.cell(4, i)
    c.value = m
    c.fill = fill(NAVY if i < 14 else AMBER_DARK)
    c.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    c.alignment = align("center")
ws2.row_dimensions[4].height = 22

def section_header(ws, row, label, bg=SLATE_MID):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=14)
    ws.cell(row, 1).value = f"  {label}"
    ws.cell(row, 1).fill = fill(bg)
    ws.cell(row, 1).font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    ws.row_dimensions[row].height = 20

def data_row(ws, row, label, values, bg=WHITE, bold=False, color=DARK_TEXT, num_fmt="#,##0"):
    ws.cell(row, 1).value = f"  {label}"
    ws.cell(row, 1).fill = fill(bg)
    ws.cell(row, 1).font = Font(bold=bold, size=10, name="Calibri", color=color)
    ws.cell(row, 1).alignment = align("left")
    ws.row_dimensions[row].height = 20
    for i, v in enumerate(values, 2):
        c = ws.cell(row, i)
        c.value = v
        c.fill = fill(bg)
        c.font = Font(bold=bold, size=10, name="Calibri", color=color)
        c.alignment = align("center")
        if isinstance(v, (int, float)) and v != 0:
            c.number_format = num_fmt

# ── SCHOOLS ──
section_header(ws2, 5, "SCHOOLS", NAVY_DARK)
new_schools =  [0, 2, 3, 3, 4, 6, 7, 10, 15, 15, 15, 20, 100]
cum_schools =  [0, 2, 5, 8, 12, 18, 25, 35, 50, 65, 80, 100, ""]
data_row(ws2, 6, "New Schools Added",  new_schools, GREY_LIGHT)
data_row(ws2, 7, "Cumulative Schools", cum_schools, BG_BLUE, bold=True, color=NAVY)

# ── REVENUE ──
section_header(ws2, 8, "REVENUE (₹)", NAVY)
arpu =  [0,8000,8500,9000,9000,9500,10000,10500,11000,11000,11500,12500,""]
mrr  =  [0,16000,42500,72000,108000,171000,250000,367500,550000,715000,920000,1250000,4462000]
arr  =  [0,192000,510000,864000,1296000,2052000,3000000,4410000,6600000,8580000,11040000,15000000,""]
data_row(ws2, 9,  "Avg Revenue / School / Month (₹)", arpu, WHITE)
data_row(ws2, 10, "Monthly Recurring Revenue — MRR", mrr, BG_BLUE, bold=True, color=NAVY)
data_row(ws2, 11, "Annual Recurring Revenue — ARR",  arr, WHITE, color=MUTED_TEXT)

# ── COSTS ──
section_header(ws2, 12, "COSTS (₹)", SLATE_MID)
eng    = [250000]*12 + [3000000]
sales  = [120000]*12 + [1440000]
infra  = [30000]*12  + [360000]
legal  = [20000]*12  + [240000]
mktg   = [30000]*12  + [360000]
total  = [450000]*12 + [5400000]
data_row(ws2, 13, "Engineering (2 developers)",      eng,   GREY_LIGHT)
data_row(ws2, 14, "Sales & Onboarding (2 RMs)",      sales, WHITE)
data_row(ws2, 15, "Infrastructure & Tools",          infra, GREY_LIGHT)
data_row(ws2, 16, "Legal / Ops / Compliance",        legal, WHITE)
data_row(ws2, 17, "Marketing & Outreach",            mktg,  GREY_LIGHT)
data_row(ws2, 18, "TOTAL MONTHLY BURN",              total, "FFF1F2", bold=True, color=RED)

# ── NET CASH FLOW ──
section_header(ws2, 19, "NET CASH FLOW (₹)", "065F46")
net = [v - 450000 for v in mrr[:12]] + [-938000]
cum_pnl_vals = []
running = 0
for v in net[:12]:
    running += v
    cum_pnl_vals.append(running)
cum_pnl_vals.append("")

data_row(ws2, 20, "Net Monthly Cash Flow",  net,         BG_GREEN, bold=False)
data_row(ws2, 21, "Cumulative P&L",         cum_pnl_vals, WHITE, color=MUTED_TEXT)

# colour net row: green if positive, red if negative
for col in range(2, 14):
    v = ws2.cell(20, col).value
    if isinstance(v, (int, float)):
        ws2.cell(20, col).fill = fill(BG_GREEN if v >= 0 else "FFF1F2")
        ws2.cell(20, col).font = Font(bold=True, size=10, name="Calibri",
                                       color=GREEN if v >= 0 else RED)

# ── CASH POSITION ──
section_header(ws2, 22, "CASH POSITION (₹)", NAVY_DARK)
opening = [20000000]
for v in net[:11]:
    opening.append(opening[-1] + v)
closing = [o + n for o, n in zip(opening, net[:12])]
opening.append("")
closing.append("")

data_row(ws2, 23, "Opening Cash",         opening, WHITE)
data_row(ws2, 24, "Net Cash Flow",        net,     GREY_LIGHT)
data_row(ws2, 25, "Closing Cash",         closing, BG_BLUE, bold=True, color=NAVY)

# Milestone row — unmerge first by writing each cell directly (no merges on row 26)
ws2.cell(26, 1).value = "  MILESTONES"
ws2.cell(26, 1).fill = fill(AMBER_DARK)
ws2.cell(26, 1).font = Font(bold=True, color=WHITE, size=10, name="Calibri")
ws2.row_dimensions[26].height = 22
milestones = ["Hiring starts","First paid schools","5 schools live","Admin portal","",
              "20 schools","","","Cash flow +ve","50 schools","","100 schools / ₹1.5Cr ARR",""]
for i, m in enumerate(milestones, 2):
    c = ws2.cell(26, i)
    c.value = m
    c.fill = fill(BG_AMBER)
    c.font = Font(size=9, color=AMBER_DARK, bold=bool(m), name="Calibri")
    c.alignment = align("center", wrap=True)

# ════════════════════════════════════════════════════════════
# SHEET 3: 3-YEAR PROJECTIONS
# ════════════════════════════════════════════════════════════
ws3 = wb.create_sheet("📈 3-Year Projections")
ws3.sheet_view.showGridLines = False
ws3.column_dimensions["A"].width = 30
for col in range(2, 10):
    ws3.column_dimensions[get_column_letter(col)].width = 18

ws3.merge_cells("A1:I1")
ws3["A1"] = "3-YEAR GROWTH PROJECTIONS — SchoolPuls Technologies"
ws3["A1"].fill = fill(SLATE)
ws3["A1"].font = Font(bold=True, color=WHITE, size=14, name="Calibri")
ws3["A1"].alignment = align("center")
ws3.row_dimensions[1].height = 32

# Year 2 quarterly headers
headers_3y = ["Metric", "Q5 (M13-15)", "Q6 (M16-18)", "Q7 (M19-21)", "Q8 (M22-24)",
              "Year 2 Total", "Year 3 (Annual)", ""]
for i, h in enumerate(headers_3y, 1):
    c = ws3.cell(3, i)
    c.value = h
    c.fill = fill(NAVY if i <= 6 else (AMBER_DARK if i == 7 else WHITE))
    c.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    c.alignment = align("center")
ws3.row_dimensions[3].height = 22

proj_data = [
    ("SCHOOLS",                  None, None, None, None, None, None, NAVY_DARK),
    ("Cumulative Schools (end)",  150,  250,  400,  600,  "",   1200, WHITE),
    ("New Schools Added",          50,  100,  150,  200,  500,  600,  GREY_LIGHT),
    ("",None,None,None,None,None,None,WHITE),
    ("REVENUE (₹)",              None, None, None, None, None, None, NAVY),
    ("MRR at end of period (₹)", 1875000, 3125000, 5000000, 7500000, "", 15000000, WHITE),
    ("Quarterly Revenue (₹)",    5062500, 9375000, 15000000, 22500000, 51937500, "", BG_BLUE),
    ("Annual Revenue (₹)",       "","","","", 51937500, 180000000, WHITE),
    ("Annual ARR (₹)",           22500000,37500000,60000000,90000000,"",180000000, GREY_LIGHT),
    ("",None,None,None,None,None,None,WHITE),
    ("COSTS (₹)",                None, None, None, None, None, None, SLATE_MID),
    ("Monthly Burn (₹)",         600000,800000,1100000,1500000,"",2000000, WHITE),
    ("Quarterly Burn (₹)",       1800000,2400000,3300000,4500000,12000000,"", GREY_LIGHT),
    ("Annual Burn (₹)",          "","","","",12000000,25000000, WHITE),
    ("",None,None,None,None,None,None,WHITE),
    ("PROFIT (₹)",               None, None, None, None, None, None, "065F46"),
    ("Quarterly Net (₹)",        3262500,6975000,11700000,18000000,39937500,"", BG_GREEN),
    ("Annual Net (₹)",           "","","","",39937500,155000000, WHITE),
]

for ri, row_data in enumerate(proj_data):
    r = 4 + ri
    ws3.row_dimensions[r].height = 22
    label, *vals, bg = row_data
    is_header = vals[0] is None
    if is_header:
        ws3.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
        ws3.cell(r, 1).value = f"  {label}" if label else ""
        ws3.cell(r, 1).fill = fill(bg)
        ws3.cell(r, 1).font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    else:
        ws3.cell(r, 1).value = f"  {label}"
        ws3.cell(r, 1).fill = fill(bg)
        ws3.cell(r, 1).font = Font(size=10, name="Calibri",
                                    bold=(bg in [BG_BLUE, BG_GREEN, GREY_LIGHT]),
                                    color=DARK_TEXT)
        ws3.cell(r, 1).alignment = align("left")
        for ci, v in enumerate(vals, 2):
            c = ws3.cell(r, ci)
            c.value = v
            c.fill = fill(bg)
            c.font = Font(size=10, name="Calibri", color=DARK_TEXT)
            c.alignment = align("center")
            if isinstance(v, (int, float)) and v != 0:
                c.number_format = "#,##0"

# ════════════════════════════════════════════════════════════
# SHEET 4: UNIT ECONOMICS
# ════════════════════════════════════════════════════════════
ws4 = wb.create_sheet("💡 Unit Economics")
ws4.sheet_view.showGridLines = False
ws4.column_dimensions["A"].width = 36
ws4.column_dimensions["B"].width = 22
ws4.column_dimensions["C"].width = 28
ws4.column_dimensions["D"].width = 20

ws4.merge_cells("A1:D1")
ws4["A1"] = "UNIT ECONOMICS & PRICING — SchoolPuls"
ws4["A1"].fill = fill(SLATE)
ws4["A1"].font = Font(bold=True, color=WHITE, size=14, name="Calibri")
ws4["A1"].alignment = align("center")
ws4.row_dimensions[1].height = 32

ue_sections = [
    ("PRICING MODEL", [
        ("Plan", "Monthly (₹)", "Annual (₹)", "Target Segment"),
        ("Starter — 1 class, 40 parents", "3,000", "36,000", "Small/pilot schools"),
        ("School — 10 classes, 400 parents", "15,000", "1,80,000", "Primary target ⭐"),
        ("Full Campus — unlimited", "40,000", "4,80,000", "Large schools"),
        ("Blended Average (conservative)", "12,500", "1,50,000", "Model assumption"),
    ]),
    ("UNIT ECONOMICS", [
        ("Metric", "Value", "Benchmark (SaaS)", "Notes"),
        ("Customer Acquisition Cost (CAC)", "₹15,000", "—", "1 RM onboards 8 schools/month"),
        ("Lifetime Value (LTV)", "₹7,50,000", "—", "5yr × ₹1.5L/yr conservative"),
        ("LTV : CAC Ratio", "50x", "Target: 3x+", "Exceptional"),
        ("Gross Margin", "~90%", "70–80% (SaaS)", "Infra cost <10% of revenue"),
        ("Payback Period", "6 weeks", "12–18 months", "Fast CAC recovery"),
        ("Churn Rate (observed)", "0%", "5–10% typical", "Zero churn in live pilot"),
    ]),
    ("COMPETITIVE PRICING", [
        ("Comparison", "Per Student / Year", "500-student school / Year", ""),
        ("Competitor (current market)", "₹1,500", "₹7,50,000", "What parents pay NOW"),
        ("SchoolPuls Full Campus", "₹960", "₹4,80,000", "36% cheaper — better product"),
        ("SchoolPuls School Plan", "₹360", "₹1,80,000", "76% cheaper"),
        ("WhatsApp Groups", "₹0", "₹0", "Free but legally risky"),
    ]),
    ("FUNDING & DILUTION", [
        ("Round", "Amount (₹)", "Pre-Money (₹)", "Dilution"),
        ("Seed (current)", "2,00,00,000", "10,00,00,000", "16.7%"),
        ("Series A (projected)", "7,50,00,000", "75,00,00,000", "9.1%"),
        ("Series B (projected)", "30,00,00,000", "3,00,00,00,000", "9.1%"),
    ]),
]

row = 3
for section_label, rows in ue_sections:
    ws4.merge_cells(start_row=row, start_column=1, end_row=row, end_column=4)
    ws4.cell(row, 1).value = f"  {section_label}"
    ws4.cell(row, 1).fill = fill(NAVY)
    ws4.cell(row, 1).font = Font(bold=True, color=WHITE, size=11, name="Calibri")
    ws4.row_dimensions[row].height = 24
    row += 1
    for ri, rdata in enumerate(rows):
        is_header = ri == 0
        bg = SLATE_MID if is_header else (BG_BLUE if ri % 2 == 0 else WHITE)
        txt_color = WHITE if is_header else DARK_TEXT
        ws4.row_dimensions[row].height = 22
        for ci, val in enumerate(rdata, 1):
            c = ws4.cell(row, ci)
            c.value = val
            c.fill = fill(bg)
            c.font = Font(bold=is_header, size=10, name="Calibri", color=txt_color)
            c.alignment = align("center" if ci > 1 else "left")
        row += 1
    row += 1  # blank between sections

# ════════════════════════════════════════════════════════════
# SHEET 5: COST BREAKDOWN
# ════════════════════════════════════════════════════════════
ws5 = wb.create_sheet("💸 Cost Breakdown")
ws5.sheet_view.showGridLines = False
ws5.column_dimensions["A"].width = 32
ws5.column_dimensions["B"].width = 20
ws5.column_dimensions["C"].width = 20
ws5.column_dimensions["D"].width = 16
ws5.column_dimensions["E"].width = 28

ws5.merge_cells("A1:E1")
ws5["A1"] = "COST STRUCTURE & USE OF FUNDS — SchoolPuls"
ws5["A1"].fill = fill(SLATE)
ws5["A1"].font = Font(bold=True, color=WHITE, size=14, name="Calibri")
ws5["A1"].alignment = align("center")
ws5.row_dimensions[1].height = 32

ws5.merge_cells("A2:E2")
ws5["A2"] = "Total Seed Raise: ₹2,00,00,000  |  Monthly Burn: ₹4,50,000  |  Runway: ~14 months"
ws5["A2"].fill = fill(NAVY)
ws5["A2"].font = Font(color=WHITE, size=10, italic=True, name="Calibri")
ws5["A2"].alignment = align("center")
ws5.row_dimensions[2].height = 18

cost_headers = ["Category", "Monthly (₹)", "Annual (₹)", "% of Raise", "Purpose"]
for ci, h in enumerate(cost_headers, 1):
    c = ws5.cell(4, ci)
    c.value = h
    c.fill = fill(SLATE_MID)
    c.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    c.alignment = align("center")
ws5.row_dimensions[4].height = 22

cost_rows = [
    ("Engineering — 2 Full-stack Devs", "2,50,000", "30,00,000", "45%",  "Admin portal, multi-tenant, WhatsApp bot",  NAVY,  BG_BLUE),
    ("Sales & Onboarding — 2 RMs",      "1,20,000", "14,40,000", "25%",  "School acquisition, onboarding support",    NAVY,  WHITE),
    ("Product & Design — UX Designer",  "75,000",   "9,00,000",  "15%",  "Product quality, parent UX",                NAVY,  BG_BLUE),
    ("Operations & Legal",              "20,000",   "2,40,000",  "10%",  "CA, legal, compliance, tools",              NAVY,  WHITE),
    ("Marketing & Outreach",            "30,000",   "3,60,000",  "5%",   "Content, social, school events",            NAVY,  BG_BLUE),
    ("TOTAL",                           "4,50,000", "54,00,000", "100%", "~14 months runway",                         AMBER_DARK, BG_AMBER),
]
for ri, (cat, mo, an, pct, purpose, fc, bg) in enumerate(cost_rows):
    r = 5 + ri
    ws5.row_dimensions[r].height = 22
    vals = [cat, mo, an, pct, purpose]
    for ci, v in enumerate(vals, 1):
        c = ws5.cell(r, ci)
        c.value = v
        c.fill = fill(bg)
        c.font = Font(bold=(ri == 5), size=10, name="Calibri", color=fc if ri == 5 else DARK_TEXT)
        c.alignment = align("left" if ci in [1,5] else "center")

ws5.row_dimensions[11].height = 12

# Runway table
ws5.merge_cells("A12:E12")
ws5["A12"] = "  RUNWAY ANALYSIS"
ws5["A12"].fill = fill(NAVY_DARK)
ws5["A12"].font = Font(bold=True, color=WHITE, size=11, name="Calibri")
ws5.row_dimensions[12].height = 24

rw_headers = ["Period", "Opening Cash (₹)", "Revenue (₹)", "Burn (₹)", "Closing Cash (₹)"]
for ci, h in enumerate(rw_headers, 1):
    c = ws5.cell(13, ci)
    c.value = h
    c.fill = fill(SLATE_MID)
    c.font = Font(bold=True, color=WHITE, size=10, name="Calibri")
    c.alignment = align("center")
ws5.row_dimensions[13].height = 20

runway_rows = [
    ("Month 1–3 (setup)",    "2,00,00,000", "42,500",     "13,50,000", "1,87,08,500"),
    ("Month 4–6 (growth)",   "1,87,08,500", "3,51,000",   "13,50,000", "1,77,09,500"),
    ("Month 7–9 (scale)",    "1,77,09,500", "11,67,500",  "13,50,000", "1,75,27,000"),
    ("Month 10–12 (ramp)",   "1,75,27,000", "28,85,000",  "13,50,000", "1,90,62,000"),
    ("YEAR 1 END",           "2,00,00,000", "44,46,000",  "54,00,000", "1,90,62,000"),
]
for ri, row_data in enumerate(runway_rows):
    r = 14 + ri
    bg = BG_AMBER if ri == 4 else (GREY_LIGHT if ri % 2 == 0 else WHITE)
    ws5.row_dimensions[r].height = 22
    for ci, v in enumerate(row_data, 1):
        c = ws5.cell(r, ci)
        c.value = v
        c.fill = fill(bg)
        c.font = Font(bold=(ri==4), size=10, name="Calibri",
                      color=AMBER_DARK if ri==4 else DARK_TEXT)
        c.alignment = align("center" if ci > 1 else "left")

# ─── Save ──────────────────────────────────────────────────
output_path = "/Users/sree/kobe/01_areas/personal-projects/schoolpulse/expansion_and_vc/tetration_ventures/financial_model/SchoolPuls_Financial_Model.xlsx"
wb.save(output_path)
print(f"✅ Saved: {output_path}")
