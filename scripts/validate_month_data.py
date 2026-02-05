
import json
import sys

def validate_schedule(filepath):
    print(f"Validating {filepath}...")
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"❌ Error loading JSON: {e}")
        return False

    errors = []
    
    # helper
    def log_err(msg):
        errors.append(msg)
        print(f"❌ {msg}")

    weeks = data.get('weeks', [])
    if not weeks:
        log_err("No weeks found")

    for w_idx, week in enumerate(weeks):
        days = week.get('days', [])
        for d_idx, day in enumerate(days):
            date_str = day.get('date', 'Unknown Date')
            day_name = day.get('dayOfWeek', 'Unknown Day')
            is_holiday = day.get('isHoliday', False)
            
            # Skip Sundays
            if day_name == 'Sunday':
                continue
                
            # Check Schedule Length for Weekdays (Mon-Fri) if not holiday
            if day_name in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
                if not is_holiday:
                    schedule = day.get('schedule', [])
                    
                    # Logic for Schedule Length
                    expected_length = 9
                    # If the day starts with a combined slot (9:10-10:00), expected items is 8
                    if schedule and schedule[0].get('time') == '9:10-10:00':
                        expected_length = 8
                             
                    if len(schedule) != expected_length:
                        log_err(f"{date_str} ({day_name}): Schedule has {len(schedule)} items, expected {expected_length}.")
                    
                    # Check Friday specific timing consistency
                    if day_name == 'Friday' and schedule:
                        first_slot = schedule[0]
                        if first_slot.get('time') != '9:10-10:00':
                             # Unless it's a holiday or special? No, strict rule.
                             log_err(f"{date_str} (Friday): First slot time is {first_slot.get('time')}, expected '9:10-10:00'.")

                    # Check AI Recap
                    if not day.get('aiSuggestedRecap'):
                        log_err(f"{date_str} ({day_name}): Missing 'aiSuggestedRecap'.")
                    
            # Check Saturday
            if day_name == 'Saturday':
                if not day.get('isWeekendRevision'):
                    log_err(f"{date_str} (Saturday): Missing isWeekendRevision=true.")
                
                revision = day.get('weekendRevisionContent', {})
                if not revision or not revision.get('subjects'):
                     log_err(f"{date_str} (Saturday): Missing weekendRevisionContent.")
                else:
                    subs = revision.get('subjects', {})
                    if not subs.get('Literacy') or not subs.get('Numeracy') or not subs.get('General Awareness'):
                         log_err(f"{date_str} (Saturday): Incomplete subjects in revision (Must have Lit, Num, GA).")

    if not errors:
        print("✅ Validation Passed! All checks OK.")
        return True
    else:
        print(f"found {len(errors)} errors.")
        return False

if __name__ == "__main__":
    success = validate_schedule('/Users/sree/claude/news/school-newsletter/data/february-2026.json')
    if not success:
        sys.exit(1)
