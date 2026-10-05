"""
Script to generate realistic enterprise PDF documents for immediate RAG testing and demoing.
"""
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak


def generate_security_policy_pdf(output_path: Path):
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=20,
    )
    h1_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=14,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )
    bullet_style = ParagraphStyle(
        "BulletDark",
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    story = []

    # Page 1: Policy Overview & Access Control
    story.append(Paragraph("Acme Global Cloud Security & Compliance Policy", title_style))
    story.append(Paragraph("Document Ref: SEC-2026-v4.2 | Classification: Confidential Enterprise Standard | Effective Date: Jan 2026", subtitle_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("1. Executive Summary & Purpose", h1_style))
    story.append(Paragraph(
        "This policy governs cybersecurity operations, cryptographic safeguards, and access controls for all Acme Corporation "
        "cloud infrastructure, microservices, and client data repositories. All employees, engineering teams, and third-party "
        "contractors are legally obligated to follow the mandates outlined in this document.",
        body_style,
    ))

    story.append(Paragraph("2. Zero Trust Identity & Access Management (IAM)", h1_style))
    story.append(Paragraph(
        "Acme mandates a strict Zero Trust architecture across all corporate environments. No device or user is inherently trusted "
        "regardless of network perimeter location.",
        body_style,
    ))
    story.append(Paragraph("• <b>Hardware MFA Requirement:</b> All access to production servers, databases, and CI/CD pipelines requires FIDO2/WebAuthn hardware security keys. SMS authentication is strictly prohibited.", bullet_style))
    story.append(Paragraph("• <b>Least Privilege Enforcement:</b> IAM roles must be scoped to the minimal required IAM policies with automatic 4-hour privilege expiry.", bullet_style))
    story.append(Paragraph("• <b>Session Timeout:</b> Corporate SSH and web console sessions automatically terminate after 15 minutes of inactivity.", bullet_style))

    story.append(PageBreak())

    # Page 2: Encryption, Incident Response & SLA
    story.append(Paragraph("3. Data Encryption & Cryptographic Standards", h1_style))
    story.append(Paragraph(
        "Customer proprietary data and internal intellectual property must be protected in all lifecycle states.",
        body_style,
    ))
    story.append(Paragraph("• <b>Encryption at Rest:</b> All databases, vector embeddings, and object storage volumes must be encrypted with AES-256 via customer-managed keys (CMEK) rotated every 90 days.", bullet_style))
    story.append(Paragraph("• <b>Encryption in Transit:</b> TLS 1.3 is strictly enforced for all public API endpoints and internal RPC traffic. TLS 1.0, 1.1, and 1.2 are formally deprecated and blocked at the edge proxy.", bullet_style))

    story.append(Paragraph("4. Incident Response Timelines & SLAs", h1_style))
    story.append(Paragraph(
        "In the event of a suspected security intrusion or data leakage event, Acme adheres to strict response SLAs:",
        body_style,
    ))

    sla_data = [
        ["Severity Level", "Definition", "Containment SLA", "Executive Notification"],
        ["P0 - Critical", "Unauthorized data exfiltration or active ransomware", "15 minutes", "30 minutes"],
        ["P1 - High", "Compromised credential with elevated permissions", "1 hour", "2 hours"],
        ["P2 - Medium", "Policy violation without data exposure", "4 hours", "24 hours"],
        ["P3 - Low", "Benign vulnerability scan or minor anomaly", "24 hours", "Weekly digest"],
    ]
    t = Table(sla_data, colWidths=[80, 200, 100, 120])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    story.append(Paragraph("5. Backup, Disaster Recovery & Retention", h1_style))
    story.append(Paragraph(
        "• <b>Recovery Point Objective (RPO):</b> Less than 15 minutes across multi-region vector caches and transactional databases.",
        bullet_style,
    ))
    story.append(Paragraph(
        "• <b>Recovery Time Objective (RTO):</b> Full failover recovery executed under 2 hours.",
        bullet_style,
    ))
    story.append(Paragraph(
        "• <b>Compliance Log Retention:</b> Immutable security audit trails, access logs, and query histories must be archived for a mandatory minimum of 7 years in WORM-compliant storage.",
        bullet_style,
    ))

    doc.build(story)
    print(f"Generated: {output_path}")


def generate_financial_report_pdf(output_path: Path):
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=20,
    )
    h1_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=14,
        spaceAfter=8,
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )
    bullet_style = ParagraphStyle(
        "BulletDark",
        parent=body_style,
        leftIndent=15,
        firstLineIndent=-10,
        spaceAfter=4,
    )

    story = []

    # Page 1: Financial Highlights
    story.append(Paragraph("NexusTech Global AI - Q3 Financial & Strategic Performance", title_style))
    story.append(Paragraph("Published: October 2026 | Prepared for: Board of Directors & Investors", subtitle_style))
    story.append(Spacer(1, 10))

    story.append(Paragraph("1. Executive Financial Summary", h1_style))
    story.append(Paragraph(
        "NexusTech experienced accelerated revenue expansion during the third quarter of 2026, driven by unprecedented demand "
        "for enterprise generative AI copilots and privacy-first Retrieval-Augmented Generation (RAG) platforms.",
        body_style,
    ))
    story.append(Paragraph("• <b>Annual Recurring Revenue (ARR):</b> Reached $84.2M, representing a 48% year-over-year increase.", bullet_style))
    story.append(Paragraph("• <b>Gross Margin:</b> Expanded to 76.4%, up 320 basis points due to GPU inference cluster optimizations.", bullet_style))
    story.append(Paragraph("• <b>Net Retention Rate (NRR):</b> Achieved 128%, demonstrating significant account expansion within Fortune 500 customers.", bullet_style))
    story.append(Paragraph("• <b>Customer Base:</b> Onboarded 350 active enterprise clients, with 42 clients generating over $250k in annual software licensing.", bullet_style))

    story.append(Spacer(1, 10))
    story.append(Paragraph("2. Strategic Product Milestones", h1_style))
    story.append(Paragraph(
        "Key product and engineering investments delivered significant performance and enterprise security advantages:",
        body_style,
    ))
    story.append(Paragraph("• <b>Hybrid RAG Search Engine:</b> Released sub-50ms hybrid dense-sparse vector indexing, decreasing retrieval hallucinations by 84%.", bullet_style))
    story.append(Paragraph("• <b>SOC-2 Type II Certification:</b> Completed comprehensive security audits with zero findings.", bullet_style))

    story.append(PageBreak())

    # Page 2: Capital Allocations & Q4 Guidance
    story.append(Paragraph("3. Departmental Budget Allocation & Capital Expenditure", h1_style))
    story.append(Paragraph(
        "Operating expenditures during Q3 were distributed strategically to accelerate AI model training and European market penetration:",
        body_style,
    ))

    fin_data = [
        ["Department", "Q3 Expenditure", "% of Total Budget", "Key Objective"],
        ["R&D & Engineering", "$18.4M", "45%", "Vector search, local LLM routing & multi-modal ingest"],
        ["Sales & Marketing", "$12.2M", "30%", "Enterprise accounts & global expansion in EMEA"],
        ["Cloud & Infrastructure", "$6.1M", "15%", "H100 GPU clusters and multi-region failover nodes"],
        ["G&A / Compliance", "$4.1M", "10%", "Legal, patent filings, and SOC2/ISO 27001 maintenance"],
    ]
    t = Table(fin_data, colWidths=[120, 90, 90, 200])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e1b4b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    story.append(Paragraph("4. Fiscal Q4 Guidance & 2027 Projections", h1_style))
    story.append(Paragraph(
        "• <b>Target Q4 ARR:</b> Expected between $96M and $100M with accelerated enterprise contract closings.",
        bullet_style,
    ))
    story.append(Paragraph(
        "• <b>Cash Flow Breakeven:</b> Projected to reach positive operating cash flow by Q1 2027.",
        bullet_style,
    ))
    story.append(Paragraph(
        "• <b>Workforce Expansion:</b> Plan to hire 45 additional AI systems engineers and enterprise solutions architects.",
        bullet_style,
    ))

    doc.build(story)
    print(f"Generated: {output_path}")


if __name__ == "__main__":
    sample_dir = Path(__file__).resolve().parent / "sample_documents"
    sample_dir.mkdir(parents=True, exist_ok=True)
    generate_security_policy_pdf(sample_dir / "Acme_Corp_Cloud_Security_Policy.pdf")
    generate_financial_report_pdf(sample_dir / "NexusTech_Q3_Strategic_Financial_Report.pdf")
    print("All enterprise sample PDFs successfully created!")
