
# QR Attendance System with Authentication

This ZIP contains two login-protected HTML tools for managing attendance using QR codes and Google Sheets.

## Files

### 1. qr-scanner-auth.html
- Scans attendee QR codes
- Sends data (ID, name, timestamp) to Google Sheets
- Includes session-level duplicate check
- Login required (checked via a separate Users sheet and Apps Script)

### 2. qr-generator-auth.html
- Generates QR codes with attendee info (ID Number, First Name, Last Name)
- QR code data is JSON formatted
- Login required

## Setup Instructions

### Google Sheets
1. **Create Attendance Sheet** for scanner submissions.
2. **Create Users Sheet** with columns `Username`, `Password`.

### Google Apps Script
1. **Create Auth Script** to verify login credentials from Users Sheet.
2. **Create Submission Script** to log scan data into Attendance Sheet.
3. Deploy both as Web Apps (Access: Anyone, Execute as Me).

### In HTML Files
- Replace `YOUR_AUTH_SCRIPT_WEB_APP_URL` with Auth Script URL
- Replace `YOUR_SUBMISSION_WEB_APP_URL` (only in scanner) with Submission Script URL

## Notes
- These are simple implementations suitable for closed-group or demo usage.
- For production, use secure auth systems like Firebase.
