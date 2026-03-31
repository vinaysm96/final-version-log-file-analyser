
const SAMPLE_LOG_CONTENT = `2401:4900:4dda:605a:f925:528:c784:8058 - - [31/Aug/2025:17:30:59 +0530] "GET /uploads/program/5faacd864d1e460c98d3b7c4956b5646.jpg HTTP/1.1" 304 - "https://www.jainuniversity.ac.in/admission/eligibility-criteria-for-UG-admissions" "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML
87.251.78.46 - - [31/Aug/2025:17:30:59 +0530] "GET /sos/ HTTP/1.1" 200 896 "http://cpgs.jainuniversity.ac.in/i.php" "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML`;

async function reproduceIssue() {
    // 1. Create a File object with the sample content
    const file = new File([SAMPLE_LOG_CONTENT], "sample_test.log", { type: "text/plain" });

    // 2. Select the Dropzone input
    const input = document.querySelector('input[type="file"]');
    if (!input) {
        console.error("Could not find file input");
        return;
    }

    // 3. Simulate file selection
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;

    // 4. Trigger change event
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);

    console.log("Simulated file upload with sample content...");
}

reproduceIssue();
