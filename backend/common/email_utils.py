"""Email utilities for development and testing."""

import os
from pathlib import Path
from django.conf import settings


def get_latest_email():
    """
    Get the latest email file saved in development mode.
    Returns the email content as a string.
    """
    if not hasattr(settings, 'EMAIL_FILE_PATH'):
        return None
    
    email_dir = Path(settings.EMAIL_FILE_PATH)
    if not email_dir.exists():
        return None
    
    # Get all email files, sorted by modification time (newest first)
    email_files = sorted(
        email_dir.glob('*'),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    
    if not email_files:
        return None
    
    # Read the most recent email
    with open(email_files[0], 'r', encoding='utf-8') as f:
        return f.read()


def get_all_emails():
    """
    Get all saved emails in development mode.
    Returns a list of email contents.
    """
    if not hasattr(settings, 'EMAIL_FILE_PATH'):
        return []
    
    email_dir = Path(settings.EMAIL_FILE_PATH)
    if not email_dir.exists():
        return []
    
    emails = []
    # Get all email files, sorted by modification time (newest first)
    email_files = sorted(
        email_dir.glob('*'),
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    
    for email_file in email_files:
        with open(email_file, 'r', encoding='utf-8') as f:
            emails.append({
                'filename': email_file.name,
                'content': f.read()
            })
    
    return emails


def extract_reset_link_from_email(email_content):
    """Extract password reset link from email content."""
    lines = email_content.split('\n')
    for i, line in enumerate(lines):
        if 'reset-password?token=' in line:
            # Clean up the line (remove encoding artifacts from quoted-printable)
            link = line.replace('=', '').replace('\r', '').strip()
            if link.startswith('http'):
                return link
    return None
