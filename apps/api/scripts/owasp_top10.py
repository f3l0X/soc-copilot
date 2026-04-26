"""OWASP Top 10 (2021) — curated entries with descriptions condensed
from the official project. Used as part of the RAG knowledge base.
"""
from __future__ import annotations

OWASP_TOP_10_2021 = [
    {
        "id": "A01:2021",
        "name": "Broken Access Control",
        "description": (
            "Restrictions on what authenticated users are allowed to do are not "
            "enforced. Common failures include violation of least privilege, "
            "bypassing access checks via URL tampering, elevation of privilege "
            "(acting as a user without being logged in or as an admin when "
            "logged in as a user), CORS misconfiguration that allows API "
            "access from unauthorized origins, IDOR (Insecure Direct Object "
            "References), missing function-level access control, and force "
            "browsing to authenticated pages. Enforce access control on the "
            "server side, deny by default, log access control failures, "
            "rate-limit API and controller access, and invalidate JWT tokens "
            "on logout."
        ),
        "tags": ["access-control", "idor", "privilege-escalation", "authz"],
    },
    {
        "id": "A02:2021",
        "name": "Cryptographic Failures",
        "description": (
            "Failures related to cryptography that often lead to exposure of "
            "sensitive data. Key issues: data transmitted in clear text "
            "(HTTP, SMTP, FTP), use of old or weak cryptographic algorithms "
            "(MD5, SHA1, DES), default or weak keys, missing encryption of "
            "sensitive data at rest, no key rotation, improper certificate "
            "validation. Mitigations: classify data, encrypt data in transit "
            "(TLS 1.2+) and at rest, use strong adaptive password hashing "
            "(Argon2, bcrypt, scrypt, PBKDF2), authenticated encryption "
            "(GCM/CCM), proper key management (HSM, KMS), and disable caching "
            "for responses with sensitive data."
        ),
        "tags": ["crypto", "tls", "hashing", "encryption", "secrets"],
    },
    {
        "id": "A03:2021",
        "name": "Injection",
        "description": (
            "An application is vulnerable when user data is not validated, "
            "filtered, or sanitized; dynamic queries or non-parameterized "
            "calls are used directly in the interpreter; or hostile data is "
            "concatenated. Includes SQL injection, NoSQL injection, OS "
            "command injection, ORM injection, LDAP injection, EL/OGNL "
            "injection, XSS (now classified here too). Prevent with safe APIs "
            "that avoid the interpreter (parameterized queries, prepared "
            "statements, ORM usage with bind variables), positive server-side "
            "input validation, escape special characters, use LIMIT and other "
            "SQL controls within queries to prevent mass disclosure, and SAST "
            "tools to detect injection in code review."
        ),
        "tags": ["injection", "sqli", "xss", "nosql", "command-injection"],
    },
    {
        "id": "A04:2021",
        "name": "Insecure Design",
        "description": (
            "A category focused on risks related to design and architectural "
            "flaws. Insecure design cannot be fixed by a perfect implementation "
            "if the design is flawed. Examples: missing or ineffective control "
            "design (no rate limiting on login, no MFA where needed), business "
            "logic flaws, lack of segmentation, plaintext password storage, "
            "credential stuffing windows. Mitigations: establish a secure "
            "development lifecycle with AppSec, use threat modeling, libraries "
            "of secure design patterns, segregate tier layers (network, "
            "container, identity), limit resource consumption per user."
        ),
        "tags": ["design", "threat-modeling", "secure-sdlc", "business-logic"],
    },
    {
        "id": "A05:2021",
        "name": "Security Misconfiguration",
        "description": (
            "The application is missing security hardening, has unnecessary "
            "features enabled (services, ports, accounts), default accounts "
            "with default passwords, error messages reveal stack traces, "
            "disabled security features, software out of date, cloud services "
            "with overly permissive permissions, missing security headers. "
            "Mitigations: hardened build process repeatable for any "
            "environment, minimal platform without unnecessary features, "
            "review and update configurations, segmented architecture, send "
            "security directives to clients (CSP, HSTS, X-Content-Type-Options), "
            "automated process to verify effectiveness of configurations."
        ),
        "tags": [
            "config",
            "hardening",
            "headers",
            "default-credentials",
            "patching",
        ],
    },
    {
        "id": "A06:2021",
        "name": "Vulnerable and Outdated Components",
        "description": (
            "Using software components (libraries, frameworks, OS) with known "
            "vulnerabilities. The risk is high when developers do not know "
            "the version of all components used (client and server side), "
            "software is unsupported or out of date, no regular vulnerability "
            "scan or subscription to security bulletins. Mitigations: remove "
            "unused dependencies, continuously inventory client/server "
            "components and their versions, monitor sources like CVE, NVD, "
            "GitHub Security Advisories; use tools like OWASP Dependency-Check, "
            "Snyk, Trivy; only obtain components from official sources over "
            "secure links; subscribe to advisories for components in use."
        ),
        "tags": ["dependencies", "cve", "supply-chain", "patching"],
    },
    {
        "id": "A07:2021",
        "name": "Identification and Authentication Failures",
        "description": (
            "Confirming user identity, authentication, and session management "
            "are critical. Authentication failures include permitting credential "
            "stuffing, brute force or other automated attacks, weak default or "
            "well-known passwords (e.g., admin/admin), weak credential recovery, "
            "plaintext or weakly hashed passwords, missing or ineffective MFA, "
            "session ID exposure in URLs, no session invalidation. Mitigations: "
            "implement MFA where possible, do not ship default credentials, "
            "implement weak password checks, align password policy with NIST "
            "800-63b, use a server-side, secure, built-in session manager that "
            "generates a new random session ID after login."
        ),
        "tags": ["auth", "session", "mfa", "credential-stuffing", "password"],
    },
    {
        "id": "A08:2021",
        "name": "Software and Data Integrity Failures",
        "description": (
            "Code and infrastructure that does not protect against integrity "
            "violations. Includes apps relying on plugins, libraries, or "
            "modules from untrusted sources, repositories, or content delivery "
            "networks; insecure CI/CD pipelines that allow unauthorized "
            "access, malicious code, or system compromise; auto-update without "
            "integrity verification; insecure deserialization. Mitigations: "
            "use digital signatures or similar mechanisms to verify the "
            "software or data is from the expected source, ensure libraries "
            "and dependencies are consuming trusted repositories, verify CI/CD "
            "pipelines have proper segregation, configuration, and access "
            "control, ensure unsigned/unencrypted serialized data is not sent "
            "to untrusted clients without integrity check or digital signature."
        ),
        "tags": [
            "supply-chain",
            "ci-cd",
            "deserialization",
            "integrity",
            "signatures",
        ],
    },
    {
        "id": "A09:2021",
        "name": "Security Logging and Monitoring Failures",
        "description": (
            "Logging and monitoring, coupled with incident response, is "
            "essential. Failures: auditable events (logins, failed logins, "
            "high-value transactions) not logged; warnings and errors generate "
            "no, inadequate, or unclear log messages; logs of applications and "
            "APIs not monitored for suspicious activity; logs only stored "
            "locally; appropriate alerting thresholds and response escalation "
            "processes not in place; penetration testing and scans by DAST "
            "tools do not trigger alerts; the application cannot detect, "
            "escalate, or alert for active attacks in real time or near real "
            "time. Mitigations: ensure all logins, access control, and server-"
            "side input validation failures are logged with sufficient user "
            "context to identify suspicious or malicious accounts and held "
            "for enough time to allow delayed forensic analysis; ensure logs "
            "are generated in a format easily consumed by log management "
            "solutions; ensure log data is encoded correctly to prevent "
            "injections or attacks on the logging or monitoring systems; "
            "establish or adopt an incident response and recovery plan."
        ),
        "tags": ["logging", "monitoring", "siem", "incident-response", "audit"],
    },
    {
        "id": "A10:2021",
        "name": "Server-Side Request Forgery (SSRF)",
        "description": (
            "SSRF flaws occur whenever a web application is fetching a remote "
            "resource without validating the user-supplied URL. It allows an "
            "attacker to coerce the application to send a crafted request to "
            "an unexpected destination, even when protected by a firewall, "
            "VPN, or another type of network access control list (ACL). With "
            "modern web architectures fetching URLs being a common scenario "
            "(cloud services and architecture complexity), SSRF can be used "
            "to read internal metadata services (AWS IMDS, GCP), scan "
            "internal networks, port-forward to internal services. "
            "Mitigations: sanitize and validate all client-supplied input "
            "data; enforce URL schema, port, destination with a positive "
            "allow list; do not send raw responses to clients; disable HTTP "
            "redirections; be aware of URL inconsistency to avoid attacks "
            "such as DNS rebinding."
        ),
        "tags": ["ssrf", "metadata", "imds", "url-validation"],
    },
]
