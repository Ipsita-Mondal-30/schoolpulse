#!/usr/bin/env python3
"""
School Newsletter PDF Processor
-------------------------------
This script extracts schedule data from the school newsletter PDF
and generates a JSON file for the web application.

Usage:
    python process-newsletter.py <pdf_path> <month> <year>

Example:
    python process-newsletter.py ../newslet.pdf february 2026
"""

import sys
import json
import re
from datetime import datetime
import PyPDF2

def extract_text_from_pdf(pdf_path):
    """Extract all text from PDF."""
    with open(pdf_path, 'rb') as file:
        reader = PyPDF2.PdfReader(file)
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                pages.append({'page': i + 1, 'text': text})
    return pages

def find_schedule_pages(pages):
    """Find pages containing schedule tables."""
    schedule_pages = []
    for page in pages:
        # Look for patterns like "PRE-PRIMARYIII" and date ranges
        if re.search(r'PRE\s*-?\s*PRIMARY\s*III', page['text'], re.IGNORECASE):
            if re.search(r'\d{2}/\d{2}/\d{4}', page['text']):
                schedule_pages.append(page)
    return schedule_pages

def find_tentative_dates_page(pages):
    """Find page with tentative dates."""
    for page in pages:
        if 'TENTATIVE' in page['text'].upper() and 'DATE' in page['text'].upper():
            # Look for date patterns
            if re.search(r'\d{2}\.\d{2}\.\d{4}', page['text']):
                return page
    return None

def find_rhymes_pages(pages):
    """Find pages with rhymes."""
    rhyme_pages = []
    for page in pages:
        if 'RHYME' in page['text'].upper():
            rhyme_pages.append(page)
    return rhyme_pages

def find_shloka_page(pages):
    """Find page with shloka."""
    for page in pages:
        if 'SHLOKA' in page['text'].upper():
            return page
    return None

def parse_date(date_str):
    """Parse date string to ISO format."""
    # Try different formats
    formats = ['%d/%m/%Y', '%d.%m.%Y', '%d-%m-%Y']
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str.strip(), fmt)
            return dt.strftime('%Y-%m-%d')
        except ValueError:
            continue
    return None

def get_day_of_week(date_str):
    """Get day of week from ISO date string."""
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    return dt.strftime('%A')

def create_template_json(month, year):
    """Create a template JSON structure."""
    return {
        "month": month.capitalize(),
        "year": int(year),
        "class": "Class 1",
        "school": "BGS National Public School",
        "weeks": [],
        "rhymes": [],
        "shloka": {
            "sanskrit": "",
            "transliteration": "",
            "meaning": ""
        },
        "story": {
            "title": "",
            "moral": ""
        },
        "importantDates": []
    }

def main():
    if len(sys.argv) < 4:
        print("Usage: python process-newsletter.py <pdf_path> <month> <year>")
        print("Example: python process-newsletter.py newslet.pdf february 2026")
        sys.exit(1)

    pdf_path = sys.argv[1]
    month = sys.argv[2]
    year = sys.argv[3]

    print(f"Processing {pdf_path} for {month} {year}...")

    # Extract text from PDF
    pages = extract_text_from_pdf(pdf_path)
    print(f"Found {len(pages)} pages")

    # Find relevant pages
    schedule_pages = find_schedule_pages(pages)
    print(f"Found {len(schedule_pages)} schedule pages")

    tentative_page = find_tentative_dates_page(pages)
    print(f"Found tentative dates page: {tentative_page['page'] if tentative_page else 'No'}")

    rhyme_pages = find_rhymes_pages(pages)
    print(f"Found {len(rhyme_pages)} rhyme pages")

    shloka_page = find_shloka_page(pages)
    print(f"Found shloka page: {shloka_page['page'] if shloka_page else 'No'}")

    # Create template JSON
    data = create_template_json(month, year)

    # Output file
    output_file = f"../data/{month.lower()}-{year}.json"

    print("\n" + "="*60)
    print("EXTRACTED CONTENT FOR REVIEW")
    print("="*60)

    # Print schedule pages for manual review
    print("\n--- SCHEDULE PAGES ---")
    for page in schedule_pages[:5]:  # First 5 schedule pages
        print(f"\n[Page {page['page']}]")
        print(page['text'][:1500])
        print("...")

    # Print tentative dates for review
    if tentative_page:
        print("\n--- TENTATIVE DATES ---")
        print(tentative_page['text'][:2000])

    # Print rhymes for review
    if rhyme_pages:
        print("\n--- RHYMES ---")
        for page in rhyme_pages[:2]:
            print(f"\n[Page {page['page']}]")
            print(page['text'][:1500])

    # Print shloka for review
    if shloka_page:
        print("\n--- SHLOKA ---")
        print(shloka_page['text'][:1000])

    print("\n" + "="*60)
    print("TEMPLATE JSON CREATED")
    print("="*60)
    print(f"\nTemplate saved to: {output_file}")
    print("\nNEXT STEPS:")
    print("1. Review the extracted content above")
    print("2. Copy the schedule data into the JSON file manually")
    print("3. The template structure has been created for you")
    print("\nAlternatively, you can ask Claude to help process this PDF!")

    # Save template
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\nTemplate JSON saved to: {output_file}")

if __name__ == "__main__":
    main()
