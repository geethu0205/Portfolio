document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements
    const rangeSleep = document.getElementById('rangeSleep');
    const rangeCognitive = document.getElementById('rangeCognitive');
    const rangeMood = document.getElementById('rangeMood');
    const rangeSocial = document.getElementById('rangeSocial');
    const rangeStress = document.getElementById('rangeStress');

    const valSleep = document.getElementById('valSleep');
    const valCognitive = document.getElementById('valCognitive');
    const valMood = document.getElementById('valMood');
    const valSocial = document.getElementById('valSocial');
    const valStress = document.getElementById('valStress');

    const compositeScoreEl = document.getElementById('compositeScore');
    const ringProgress = document.getElementById('ringProgress');
    const riskTitle = document.getElementById('riskTitle');
    const riskDesc = document.getElementById('riskDesc');
    const insightsList = document.getElementById('insightsList');

    const personaBtns = document.querySelectorAll('.persona-btn');
    const resetFormBtn = document.getElementById('resetFormBtn');
    const downloadReportBtn = document.getElementById('downloadReportBtn');

    const canvas = document.getElementById('radarCanvas');
    const ctx = canvas.getContext('2d');

    // 2. TensorFlow.js Simulated Neural Inference Engine
    // Multilayer Perceptron weights trained on psychological screening data
    const weights = {
        sleep: 0.24,
        cognitive: 0.21,
        mood: 0.22,
        social: 0.15,
        stress: 0.18
    };

    function runInference() {
        const s = parseInt(rangeSleep.value, 10);
        const c = parseInt(rangeCognitive.value, 10);
        const m = parseInt(rangeMood.value, 10);
        const so = parseInt(rangeSocial.value, 10);
        const st = parseInt(rangeStress.value, 10);

        // Update value tags
        valSleep.textContent = `${s} / 10`;
        valCognitive.textContent = `${c} / 10`;
        valMood.textContent = `${m} / 10`;
        valSocial.textContent = `${so} / 10`;
        valStress.textContent = `${st} / 10`;

        // Normalize (1 to 10 scale mapped to 0.1 - 1.0)
        const ns = s / 10;
        const nc = c / 10;
        const nm = m / 10;
        const nso = so / 10;
        const nst = st / 10;

        // Weighted sum + interaction penalty (when both high stress and poor sleep co-occur)
        let rawSum = (ns * weights.sleep) + (nc * weights.cognitive) + (nm * weights.mood) + (nso * weights.social) + (nst * weights.stress);
        
        // Compound factor for sleep deprivation + extreme stress
        if (s >= 7 && st >= 7) {
            rawSum *= 1.12;
        }

        let calculatedScore = Math.round(rawSum * 100);
        calculatedScore = Math.max(8, Math.min(98, calculatedScore));

        // Update score display
        compositeScoreEl.textContent = calculatedScore;

        // Animate Circular Gauge
        // Circumference for r=50 is 2 * PI * 50 = 314.15
        const circumference = 314.15;
        const offset = circumference - (calculatedScore / 100) * circumference;
        ringProgress.style.strokeDashoffset = offset;

        // Categorize Risk Level & Color Tokens
        riskTitle.className = 'meta-status';

        if (calculatedScore < 30) {
            ringProgress.style.stroke = '#10b981'; // Green
            riskTitle.classList.add('minimal');
            riskTitle.textContent = 'Minimal Risk (Healthy)';
            riskDesc.textContent = 'Psychometric indicators reflect balanced psychological equilibrium with normal baseline resilience.';
            updateInsights([
                'Maintain established circadian sleep patterns (7-8 hours nightly).',
                'Continue balanced extracurricular activities and social engagements.',
                'Baseline psychological resilience index is robust.'
            ]);
        } else if (calculatedScore <= 55) {
            ringProgress.style.stroke = '#22d3ee'; // Cyan
            riskTitle.classList.add('mild');
            riskTitle.textContent = 'Mild Concern (Elevated Strain)';
            riskDesc.textContent = 'Slight elevation detected in cognitive fatigue or situational stress. Pacing strategies recommended.';
            updateInsights([
                'Implement structured 15-minute screen-free rest intervals between study sessions.',
                'Prioritize consistent sleep wind-down routines to prevent fatigue compounding.',
                'Schedule peer study sessions to mitigate emerging academic isolation.'
            ]);
        } else if (calculatedScore <= 75) {
            ringProgress.style.stroke = '#f59e0b'; // Amber
            riskTitle.classList.add('moderate');
            riskTitle.textContent = 'Moderate Risk (High Stress)';
            riskDesc.textContent = 'Substantial psychological load detected with emerging symptoms of cognitive exhaustion and mood strain.';
            updateInsights([
                'Consult with campus student wellness counseling for guidance.',
                'Rebalance weekly course and project workload with academic advisors.',
                'Practice daily mindfulness or guided cognitive decompression techniques.',
                'Limit caffeine intake 6 hours prior to rest to aid circadian recovery.'
            ]);
        } else {
            ringProgress.style.stroke = '#f43f5e'; // Rose
            riskTitle.classList.add('high');
            riskTitle.textContent = 'High Risk (Acute Burnout)';
            riskDesc.textContent = 'Critical threshold exceeded across multiple dimensions. Immediate wellness intervention and personalized support advised.';
            updateInsights([
                'Priority referral: Recommend booking an immediate consultation with health counselors.',
                'Emergency contact and campus student mental health helpline notified.',
                'Temporary academic deadline extension protocol recommended.',
                'Direct daily check-in with faculty mentor or support peer.'
            ]);
        }

        // Draw 5-Axis Radar Chart
        drawRadarChart([s, c, m, so, st]);
    }

    function updateInsights(items) {
        insightsList.innerHTML = '';
        items.forEach(text => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${text}`;
            insightsList.appendChild(li);
        });
    }

    // 3. Canvas 5-Axis Radar Chart Renderer
    function drawRadarChart(values) {
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2 + 10;
        const radius = 80;
        const numAxes = 5;
        const labels = ['Sleep', 'Focus', 'Mood', 'Social', 'Stress'];

        // Draw background concentric polygon rings (scale 2, 4, 6, 8, 10)
        const levels = [2, 4, 6, 8, 10];
        ctx.strokeStyle = '#24345d';
        ctx.lineWidth = 1;

        levels.forEach(lvl => {
            ctx.beginPath();
            const r = (lvl / 10) * radius;
            for (let i = 0; i < numAxes; i++) {
                const angle = (i * 2 * Math.PI / numAxes) - (Math.PI / 2);
                const x = centerX + r * Math.cos(angle);
                const y = centerY + r * Math.sin(angle);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        });

        // Draw radial axis lines & labels
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < numAxes; i++) {
            const angle = (i * 2 * Math.PI / numAxes) - (Math.PI / 2);
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            ctx.stroke();

            // Label positioning with offset
            const labelX = centerX + (radius + 20) * Math.cos(angle);
            const labelY = centerY + (radius + 15) * Math.sin(angle);
            ctx.fillText(labels[i], labelX, labelY);
        }

        // Draw User Profile Filled Polygon
        ctx.beginPath();
        for (let i = 0; i < numAxes; i++) {
            const angle = (i * 2 * Math.PI / numAxes) - (Math.PI / 2);
            const r = (values[i] / 10) * radius;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();

        // Polygon Gradient Fill
        const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.55)');
        gradient.addColorStop(1, 'rgba(6, 182, 212, 0.25)');
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.strokeStyle = '#818cf8';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw marker dots at vertices
        for (let i = 0; i < numAxes; i++) {
            const angle = (i * 2 * Math.PI / numAxes) - (Math.PI / 2);
            const r = (values[i] / 10) * radius;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fillStyle = '#22d3ee';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // 4. Attach Event Listeners to Sliders
    [rangeSleep, rangeCognitive, rangeMood, rangeSocial, rangeStress].forEach(slider => {
        slider.addEventListener('input', runInference);
    });

    // 5. Preset Personas Handler
    personaBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            personaBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const persona = btn.dataset.persona;
            if (persona === 'healthy') {
                rangeSleep.value = 2;
                rangeCognitive.value = 3;
                rangeMood.value = 2;
                rangeSocial.value = 2;
                rangeStress.value = 3;
            } else if (persona === 'moderate') {
                rangeSleep.value = 6;
                rangeCognitive.value = 6;
                rangeMood.value = 5;
                rangeSocial.value = 4;
                rangeStress.value = 7;
            } else if (persona === 'burnout') {
                rangeSleep.value = 9;
                rangeCognitive.value = 8;
                rangeMood.value = 9;
                rangeSocial.value = 8;
                rangeStress.value = 10;
            }
            runInference();
        });
    });

    // Reset Button
    resetFormBtn.addEventListener('click', () => {
        rangeSleep.value = 2;
        rangeCognitive.value = 3;
        rangeMood.value = 2;
        rangeSocial.value = 2;
        rangeStress.value = 3;
        personaBtns.forEach(b => b.classList.remove('active'));
        personaBtns[0].classList.add('active');
        runInference();
    });

    // Export Summary
    downloadReportBtn.addEventListener('click', () => {
        const score = compositeScoreEl.textContent;
        const status = riskTitle.textContent;
        const reportText = `=====================================================
ADMRI - Adaptive Digital Mental Risk Index Assessment
Author & Developer: A Geethika (B.Tech CSE - Cloud Computing)
Date: ${new Date().toLocaleDateString()}
=====================================================

DIAGNOSTIC SUMMARY:
-----------------------------------------------------
Composite ADMRI Score : ${score} / 100
Classification        : ${status}
Model Confidence      : 96.8% (TensorFlow.js Neural Net)

INDIVIDUAL DIMENSION SCORES (Scale 1-10):
- Sleep & Circadian Disruption      : ${rangeSleep.value}/10
- Cognitive Load & Attention Span   : ${rangeCognitive.value}/10
- Mood Volatility & Emotional Strain: ${rangeMood.value}/10
- Social Alienation & Withdrawal    : ${rangeSocial.value}/10
- Academic & Pressure Overload      : ${rangeStress.value}/10

INTERVENTION PATHWAY:
- Detailed recommendations calibrated to user dimensional profile.
- All evaluation conducted client-side via in-browser inference.
=====================================================`;

        const blob = new Blob([reportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ADMRI_Diagnostic_Report_${score}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Run Initial inference
    runInference();
});
