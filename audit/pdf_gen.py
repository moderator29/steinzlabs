#!/usr/bin/env python3
"""
Steinz Labs Audit — PDF Generator
Usage: python3 pdf_gen.py <input_txt> <output_pdf>
"""
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

W, H = A4

def build_styles():
    base = getSampleStyleSheet()
    s = {}
    s['cover_title'] = ParagraphStyle('cover_title', fontSize=28, leading=34,
        textColor=colors.HexColor('#0A0A0A'), spaceAfter=8, alignment=TA_CENTER,
        fontName='Helvetica-Bold')
    s['cover_sub'] = ParagraphStyle('cover_sub', fontSize=13, leading=17,
        textColor=colors.HexColor('#444444'), spaceAfter=4, alignment=TA_CENTER)
    s['h1'] = ParagraphStyle('h1', fontSize=18, leading=24,
        textColor=colors.HexColor('#0A0A0A'), spaceBefore=18, spaceAfter=8,
        fontName='Helvetica-Bold', borderPad=4,
        borderColor=colors.HexColor('#0000FF'), borderWidth=0,
        backColor=colors.HexColor('#F0F4FF'), leftIndent=0)
    s['h2'] = ParagraphStyle('h2', fontSize=13, leading=18,
        textColor=colors.HexColor('#1A1A2E'), spaceBefore=12, spaceAfter=6,
        fontName='Helvetica-Bold')
    s['h3'] = ParagraphStyle('h3', fontSize=11, leading=15,
        textColor=colors.HexColor('#2D2D2D'), spaceBefore=8, spaceAfter=4,
        fontName='Helvetica-Bold')
    s['body'] = ParagraphStyle('body', fontSize=9, leading=13,
        textColor=colors.HexColor('#1A1A1A'), spaceAfter=3)
    s['code'] = ParagraphStyle('code', fontSize=8, leading=11,
        fontName='Courier', textColor=colors.HexColor('#1A1A2E'),
        backColor=colors.HexColor('#F5F5F5'), leftIndent=12, spaceAfter=2)
    s['bullet'] = ParagraphStyle('bullet', fontSize=9, leading=13,
        textColor=colors.HexColor('#1A1A1A'), leftIndent=16, spaceAfter=2,
        bulletIndent=6)
    s['warn'] = ParagraphStyle('warn', fontSize=9, leading=13,
        textColor=colors.HexColor('#7B1A00'), backColor=colors.HexColor('#FFF3F0'),
        leftIndent=10, spaceAfter=3, borderPad=4)
    s['ok'] = ParagraphStyle('ok', fontSize=9, leading=13,
        textColor=colors.HexColor('#004D1A'), backColor=colors.HexColor('#F0FFF4'),
        leftIndent=10, spaceAfter=3, borderPad=4)
    s['label'] = ParagraphStyle('label', fontSize=8, leading=11,
        fontName='Helvetica-Bold', textColor=colors.HexColor('#444444'),
        spaceAfter=1)
    return s

def parse_and_build(text, styles):
    story = []
    lines = text.split('\n')
    i = 0

    # Detect table blocks
    def is_table_line(l):
        return l.strip().startswith('|') and '|' in l[1:]

    def flush_table(rows):
        if not rows:
            return
        # strip separator rows
        data_rows = [r for r in rows if not all(c.strip().replace('-','').replace(':','') == '' for c in r)]
        if not data_rows:
            return
        col_count = max(len(r) for r in data_rows)
        # pad
        padded = [r + [''] * (col_count - len(r)) for r in data_rows]
        # build table cells as Paragraphs
        cell_style = ParagraphStyle('tc', fontSize=8, leading=10, wordWrap='CJK')
        header_style = ParagraphStyle('th', fontSize=8, leading=10,
            fontName='Helvetica-Bold', wordWrap='CJK')
        table_data = []
        for ri, row in enumerate(padded):
            table_row = []
            for ci, cell in enumerate(row):
                st = header_style if ri == 0 else cell_style
                table_row.append(Paragraph(cell.strip(), st))
            table_data.append(table_row)

        col_width = (W - 3*cm) / col_count
        t = Table(table_data, colWidths=[col_width]*col_count, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1A1A2E')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8F9FA')]),
            ('GRID', (0,0), (-1,-1), 0.4, colors.HexColor('#CCCCCC')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (0,0), (-1,-1), 4),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ]))
        story.append(t)
        story.append(Spacer(1, 6))

    table_buffer = []

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Collect table rows
        if is_table_line(stripped):
            cells = [c for c in stripped.split('|')[1:-1]]
            table_buffer.append(cells)
            i += 1
            continue
        else:
            if table_buffer:
                flush_table(table_buffer)
                table_buffer = []

        # H1
        if stripped.startswith('# ') or stripped.startswith('## STEINZ') or stripped.startswith('# STEINZ'):
            story.append(HRFlowable(width='100%', thickness=2, color=colors.HexColor('#0A1EFF')))
            story.append(Spacer(1, 6))
            story.append(Paragraph(stripped.lstrip('#').strip(), styles['h1']))
            i += 1
            continue

        # H2
        if stripped.startswith('## '):
            story.append(Paragraph(stripped.lstrip('#').strip(), styles['h2']))
            i += 1
            continue

        # H3
        if stripped.startswith('### '):
            story.append(Paragraph(stripped.lstrip('#').strip(), styles['h3']))
            i += 1
            continue

        # H4
        if stripped.startswith('#### '):
            story.append(Paragraph(stripped.lstrip('#').strip(), styles['h3']))
            i += 1
            continue

        # HR
        if stripped.startswith('---'):
            story.append(HRFlowable(width='100%', thickness=0.5, color=colors.HexColor('#CCCCCC')))
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Bullet
        if stripped.startswith('- ') or stripped.startswith('* '):
            text_content = stripped[2:]
            # bold inline
            text_content = text_content.replace('**', '<b>', 1).replace('**', '</b>', 1)
            story.append(Paragraph(f'• {text_content}', styles['bullet']))
            i += 1
            continue

        # Numbered list
        import re
        if re.match(r'^\d+\.\s', stripped):
            text_content = re.sub(r'^\d+\.\s', '', stripped)
            text_content = text_content.replace('**', '<b>', 1).replace('**', '</b>', 1)
            story.append(Paragraph(f'  {text_content}', styles['bullet']))
            i += 1
            continue

        # Code block
        if stripped.startswith('```') or stripped.startswith('    '):
            story.append(Paragraph(stripped.lstrip('`').strip() or line, styles['code']))
            i += 1
            continue

        # WARN lines
        if any(stripped.startswith(w) for w in ['**CRITICAL', '**BUG', '⚠', 'CRITICAL:', 'WARNING:']):
            story.append(Paragraph(stripped.replace('**',''), styles['warn']))
            i += 1
            continue

        # Blank line
        if stripped == '':
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Default body — handle inline bold
        text_content = stripped
        import re as _re
        text_content = _re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text_content)
        text_content = _re.sub(r'`(.+?)`', r'<font name="Courier" size="8">\1</font>', text_content)
        story.append(Paragraph(text_content, styles['body']))
        i += 1

    if table_buffer:
        flush_table(table_buffer)

    return story


def make_pdf(input_path, output_path, section_title=''):
    with open(input_path, 'r', encoding='utf-8') as f:
        text = f.read()

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=1.5*cm,
        rightMargin=1.5*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
        title=f'Steinz Labs Audit — {section_title}',
        author='VTX Audit Engine',
    )

    styles = build_styles()
    story = []

    # Cover block
    story.append(Spacer(1, 20))
    story.append(Paragraph('STEINZ LABS', styles['cover_title']))
    story.append(Paragraph('Full Platform Audit Report', styles['cover_sub']))
    if section_title:
        story.append(Paragraph(section_title, styles['cover_sub']))
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width='100%', thickness=2, color=colors.HexColor('#0A1EFF')))
    story.append(Spacer(1, 12))

    story += parse_and_build(text, styles)

    doc.build(story)
    print(f'PDF written: {output_path}')


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python3 pdf_gen.py <input.txt> <output.pdf> [section title]')
        sys.exit(1)
    title = sys.argv[3] if len(sys.argv) > 3 else ''
    make_pdf(sys.argv[1], sys.argv[2], title)
