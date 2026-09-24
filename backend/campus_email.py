"""Student identity policy. Domain validation does not verify mailbox ownership."""
import re
MESSAGE = "Student accounts require an @chitkara.edu.in university email address."

def is_student_email(value):
    email = value.strip().lower()
    return bool(re.fullmatch(r"[a-z0-9]+(?:[._+-][a-z0-9]+)*@chitkara\.edu\.in", email))

def require_student_email(value):
    if not is_student_email(value):
        raise ValueError(MESSAGE)
    return value.strip().lower()
