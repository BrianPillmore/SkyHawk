import fitz, os, re, json

reports_dir = r'C:\Users\brian\GitHub\SkyHawk\plans\eagleview_reports'
all_reports = []

for fname in sorted(os.listdir(reports_dir)):
    if not fname.upper().endswith('.PDF'):
        continue
    report_id = fname.split('_')[0]
    path = os.path.join(reports_dir, fname)
    doc = fitz.open(path)

    all_text = ''
    page_texts = []
    for i in range(len(doc)):
        t = doc[i].get_text()
        page_texts.append(t)
        all_text += t + '\n'
    doc.close()

    record = {'reportId': report_id}

    # Address
    for line in all_text.split('\n'):
        m = re.match(r'(\d+\s+.*?,\s+\w.*?,\s+OK\s+\d+)', line.strip())
        if m:
            record['address'] = m.group(1).strip()
            break

    # Coordinates
    lat_m = re.search(r'Latitude\s*=\s*([\d.-]+)', all_text)
    lng_m = re.search(r'Longitude\s*=\s*([\d.-]+)', all_text)
    if lat_m: record['latitude'] = float(lat_m.group(1))
    if lng_m: record['longitude'] = float(lng_m.group(1))

    # Report date
    date_m = re.search(r'Premium Report\s*\n\s*(\d+/\d+/\d+)', all_text)
    if date_m: record['reportDate'] = date_m.group(1)

    # Claim
    claim_m = re.search(r'Claim Number:\s*([\w-]+)', all_text)
    if claim_m: record['claimNumber'] = claim_m.group(1)
    dol_m = re.search(r'Date Of Loss:\s*([\d-]+)', all_text)
    if dol_m: record['dateOfLoss'] = dol_m.group(1)

    # Summary metrics
    def extract_int(pattern):
        m = re.search(pattern, all_text)
        return int(m.group(1).replace(',','')) if m else None

    record['totalRoofAreaSqFt'] = extract_int(r'Total Roof Area\s*=\s*([\d,]+)\s*sq\s*ft')
    if record.get('totalRoofAreaSqFt') is None:
        record['totalRoofAreaSqFt'] = extract_int(r'Total Area.*?=\s*([\d,]+)\s*sq\s*ft')

    record['totalRoofFacets'] = extract_int(r'Total Roof Facets\s*=\s*(\d+)')

    pitch_m = re.search(r'Predominant Pitch\s*=\s*(\d+/\d+)', all_text)
    if pitch_m: record['predominantPitch'] = pitch_m.group(1)

    stories_m = re.search(r'Number of Stories\s*([\w><=]+)', all_text)
    if stories_m: record['numberOfStories'] = stories_m.group(1).strip()

    attic_m = re.search(r'Estimated Attic\s*=?\s*([\d,]+)\s*sq\s*ft', all_text)
    if attic_m: record['estimatedAtticSqFt'] = int(attic_m.group(1).replace(',',''))

    # Line lengths with counts
    def extract_line(pattern):
        m = re.search(pattern, all_text)
        if m: return {'totalFt': int(m.group(1)), 'count': int(m.group(2))}
        return {'totalFt': 0, 'count': 0}

    record['lengths'] = {
        'ridges': extract_line(r'Ridges\s*=\s*(\d+)\s*ft\s*\((\d+)\s*Ridge'),
        'hips': extract_line(r'Hips\s*=\s*(\d+)\s*ft\s*\((\d+)\s*Hip'),
        'valleys': extract_line(r'Valleys\s*=\s*(\d+)\s*ft\s*\((\d+)\s*Valle'),
        'rakes': extract_line(r'Rakes.*?=\s*(\d+)\s*ft\s*\((\d+)\s*Rake'),
        'eaves': extract_line(r'Eaves.*?=\s*(\d+)\s*ft\s*\((\d+)\s*Eave'),
        'dripEdge': extract_line(r'Drip Edge.*?=\s*(\d+)\s*ft\s*\((\d+)\s*Length'),
        'flashing': extract_line(r'(?<!Step\s)Flashing\s*=\s*(\d+)\s*ft\s*\((\d+)\s*Length'),
        'stepFlashing': extract_line(r'Step flashing\s*=\s*(\d+)\s*ft\s*\((\d+)\s*Length'),
        'parapets': extract_line(r'Parapet Walls\s*=\s*(\d+)\s*\((\d+)\s*Length'),
    }

    # Pitch breakdown from REPORT SUMMARY page
    pitch_breakdown = []
    for pt in page_texts:
        if 'Areas per Pitch' in pt and 'The table above' in pt:
            section = pt[pt.index('Areas per Pitch'):pt.index('The table above')]
            pitch_vals = re.findall(r'(\d+/\d+)', section)
            remaining = section
            for p in pitch_vals:
                remaining = remaining.replace(p, '', 1)
            all_nums = re.findall(r'([\d.]+)', remaining)
            n = len(pitch_vals)
            if n > 0 and len(all_nums) >= n * 2:
                for j in range(n):
                    pitch_breakdown.append({
                        'pitch': pitch_vals[j],
                        'areaSqFt': float(all_nums[j]),
                        'percentOfRoof': float(all_nums[n + j])
                    })
            break
    record['pitchBreakdown'] = pitch_breakdown

    # Waste table from REPORT SUMMARY page
    waste_table = []
    suggested_waste = None
    for pt in page_texts:
        if 'Waste Calculation' not in pt:
            continue
        section = pt[pt.index('Waste Calculation'):]
        if 'Waste %' in section and 'Squares' in section:
            waste_section = section[section.index('Waste %'):]
            lines = waste_section.split('\n')
            waste_pcts = []
            areas = []
            squares = []
            current_row = 0
            for line in lines:
                line = line.strip()
                if line.startswith('Waste %'):
                    current_row = 0
                    continue
                if line.startswith('Area'):
                    current_row = 1
                    continue
                if line.startswith('Squares'):
                    current_row = 2
                    continue
                if 'Measured' in line or 'Suggested' in line or 'Additional' in line:
                    continue
                if not line or line.startswith('*') or line.startswith('The') or line.startswith('NOTE'):
                    continue
                if current_row == 0:
                    pcts = re.findall(r'(\d+)%', line)
                    waste_pcts.extend([int(p) for p in pcts])
                elif current_row == 1:
                    nums = re.findall(r'([\d,]+)', line)
                    areas.extend([int(n.replace(',','')) for n in nums if int(n.replace(',','')) > 0])
                elif current_row == 2:
                    nums = re.findall(r'(\d+\.\d+)', line)
                    squares.extend([float(n) for n in nums])

            for j in range(min(len(waste_pcts), len(areas), len(squares))):
                waste_table.append({
                    'wastePercent': waste_pcts[j],
                    'areaSqFt': areas[j],
                    'squares': squares[j]
                })

        if 'Suggested' in section:
            idx = section.index('Suggested')
            nearby = section[max(0,idx-300):idx+50]
            pcts = re.findall(r'(\d+)%', nearby)
            if pcts:
                suggested_waste = int(pcts[-1])
        break

    record['wasteTable'] = waste_table
    record['suggestedWastePercent'] = suggested_waste

    # Complexity
    record['structureComplexity'] = 'Unknown'
    for pt in page_texts:
        if 'Structure Complexity' in pt:
            record['structureComplexity'] = 'Complex'
            break

    all_reports.append(record)

# Save to file
output_path = r'C:\Users\brian\GitHub\SkyHawk\tests\fixtures\eagleview-calibration.json'
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, 'w') as f:
    json.dump(all_reports, f, indent=2)

print(json.dumps(all_reports, indent=2))
