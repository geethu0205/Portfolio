document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Simulator Element References ---
    const foodCategorySelect = document.getElementById('foodCategory');
    const currentStockSlider = document.getElementById('currentStock');
    const footfallSlider = document.getElementById('footfall');
    const shelfLifeSlider = document.getElementById('shelfLife');
    const weatherRadios = document.querySelectorAll('input[name="weather"]');

    const stockDisplay = document.getElementById('stockDisplay');
    const footfallDisplay = document.getElementById('footfallDisplay');
    const shelfLifeDisplay = document.getElementById('shelfLifeDisplay');

    const predDemandEl = document.getElementById('predDemand');
    const predUnitEl = document.getElementById('predUnit');
    const stockDiffEl = document.getElementById('stockDiff');
    const spoilageProbEl = document.getElementById('spoilageProb');
    const spoilageBadge = document.getElementById('spoilageBadge');
    const gaugeBar = document.getElementById('gaugeBar');
    const decayLabel = document.getElementById('decayLabel');

    const decisionBox = document.getElementById('decisionBox');
    const decisionIcon = document.getElementById('decisionIcon');
    const decisionTitle = document.getElementById('decisionTitle');
    const decisionDesc = document.getElementById('decisionDesc');
    const actionBtnWrap = document.getElementById('actionBtnWrap');

    const foodSavedKgEl = document.getElementById('foodSavedKg');
    const co2OffsetEl = document.getElementById('co2Offset');
    const costPreservedEl = document.getElementById('costPreserved');

    const resetSimBtn = document.getElementById('resetSimBtn');
    const scenarioBtns = document.querySelectorAll('.scenario-btn');

    let currentDayScenario = 'weekday';

    // --- 2. Live XGBoost Simulation Engine ---
    function runXGBoostInference() {
        const selectedOption = foodCategorySelect.options[foodCategorySelect.selectedIndex];
        const baseDemand = parseFloat(selectedOption.dataset.base || 200);
        const unit = selectedOption.dataset.unit || 'units';

        const stock = parseInt(currentStockSlider.value, 10);
        const footfall = parseInt(footfallSlider.value, 10);
        const shelfDays = parseInt(shelfLifeSlider.value, 10);

        let weatherMultiplier = 1.0;
        const selectedWeather = document.querySelector('input[name="weather"]:checked')?.value || 'clear';
        if (selectedWeather === 'hot') weatherMultiplier = 1.15; // Higher demand for fresh food/beverages, faster decay
        if (selectedWeather === 'rain') weatherMultiplier = 0.82; // Decreased footfall

        let scenarioMultiplier = 1.0;
        if (currentDayScenario === 'weekend') scenarioMultiplier = 1.35;
        if (currentDayScenario === 'holiday') scenarioMultiplier = 1.65;
        if (currentDayScenario === 'rain') scenarioMultiplier = 0.78;

        // Display current slider values
        stockDisplay.textContent = `${stock} ${unit}`;
        footfallDisplay.textContent = `${footfall} people`;
        shelfLifeDisplay.textContent = `${shelfDays} ${shelfDays === 1 ? 'day' : 'days'}`;
        predUnitEl.textContent = unit;

        // XGBoost Model Simulation Formula:
        // Demand ~ (BaseDemand * (Footfall / 650) * scenarioMultiplier * weatherMultiplier) + slight non-linear feature weight
        const footfallRatio = footfall / 650;
        const featureWeightNoise = Math.sin(footfall * 0.05) * 4;
        let predictedDemand = Math.round((baseDemand * footfallRatio * scenarioMultiplier * weatherMultiplier) + featureWeightNoise);
        if (predictedDemand < 10) predictedDemand = 10;

        // Spoilage Risk Probability:
        // High if stock >> demand and shelf days is low (1 or 2 days)
        const surplusUnits = stock - predictedDemand;
        let spoilageRatio = 0;

        if (surplusUnits > 0) {
            // Decay risk rises rapidly with shorter shelf life
            const decaySensitivity = (8 - shelfDays) / 7; // 1 day = 1.0, 7 days = 0.14
            spoilageRatio = (surplusUnits / stock) * decaySensitivity * (selectedWeather === 'hot' ? 1.25 : 1.0);
        } else {
            // Understocked -> almost zero spoilage risk, but stockout risk
            spoilageRatio = 0.03 * (1 / shelfDays);
        }

        let spoilagePercent = Math.min(Math.max(spoilageRatio * 100, 3.5), 98.5);
        spoilagePercent = Math.round(spoilagePercent * 10) / 10;

        // Update UI Numbers with micro-animations
        predDemandEl.textContent = predictedDemand;
        spoilageProbEl.textContent = `${spoilagePercent.toFixed(1)}%`;
        gaugeBar.style.width = `${spoilagePercent}%`;

        // Surplus / Deficit tag
        if (surplusUnits > 0) {
            stockDiffEl.textContent = `+${surplusUnits} ${unit} Surplus`;
            stockDiffEl.style.color = surplusUnits > 60 ? '#f59e0b' : '#34d399';
        } else if (surplusUnits < 0) {
            stockDiffEl.textContent = `${surplusUnits} ${unit} Deficit`;
            stockDiffEl.style.color = '#60a5fa';
        } else {
            stockDiffEl.textContent = `Exact Match (0 delta)`;
            stockDiffEl.style.color = '#34d399';
        }

        // Spoilage Badge & Gauge Label
        spoilageBadge.className = 'pred-status';
        decisionBox.className = 'decision-box';

        if (spoilagePercent < 25) {
            spoilageBadge.classList.add('low');
            spoilageBadge.innerHTML = '<i class="fa-solid fa-shield"></i> Low Risk';
            decayLabel.textContent = 'Low Spoilage Likelihood';

            if (surplusUnits < -20) {
                // Stockout risk
                decisionBox.classList.add('warning');
                decisionIcon.innerHTML = '<i class="fa-solid fa-cart-plus"></i>';
                decisionTitle.textContent = `Stock Deficit Detected: Order ${Math.abs(surplusUnits)} ${unit}`;
                decisionDesc.textContent = `High projected dining footfall will deplete current stock before closing. Automatic purchase requisition triggered via Spark stream.`;
                actionBtnWrap.innerHTML = `<span class="action-tag" style="color: #60a5fa;"><i class="fa-solid fa-truck-fast"></i> Automated PO Dispatched to Supplier</span>`;
            } else {
                decisionTitle.textContent = 'Stock Balanced: Optimal Equilibrium';
                decisionDesc.textContent = 'Current stock precisely balances customer dining demand. Inventory decay risk is minimal, minimizing food discards.';
                actionBtnWrap.innerHTML = `<span class="action-tag"><i class="fa-solid fa-check"></i> Monitored via Real-Time Spark Workers</span>`;
            }
        } else if (spoilagePercent <= 55) {
            spoilageBadge.classList.add('med');
            spoilageBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Moderate Risk';
            decayLabel.textContent = 'Elevated Spoilage Warning';
            decisionBox.classList.add('warning');

            decisionIcon.innerHTML = '<i class="fa-solid fa-tags"></i>';
            decisionTitle.textContent = `Surplus Decay Alert: Apply 25% Dynamic Markdown`;
            decisionDesc.textContent = `Forecasted demand will leave ~${surplusUnits} ${unit} unsold with only ${shelfDays} days shelf life. Triggering dynamic digital menu promotion to accelerate clearance.`;
            actionBtnWrap.innerHTML = `<span class="action-tag" style="color: #fbbf24;"><i class="fa-solid fa-bullhorn"></i> Push Promo to Student App</span>`;
        } else {
            spoilageBadge.classList.add('high');
            spoilageBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Critical Spoilage Risk';
            decayLabel.textContent = 'Critical Spoilage Danger!';
            decisionBox.classList.add('danger');

            decisionIcon.innerHTML = '<i class="fa-solid fa-recycle"></i>';
            decisionTitle.textContent = `Critical Overstock: Reallocate or Donate Immediately`;
            decisionDesc.textContent = `Major oversupply of ${surplusUnits} ${unit} under imminent expiry horizon. System recommends bulk redistribution to campus central banquet or community food bank.`;
            actionBtnWrap.innerHTML = `<span class="action-tag" style="color: #fb7185;"><i class="fa-solid fa-hand-holding-heart"></i> Food Bank Dispatch Order Generated</span>`;
        }

        // Calculate Savings Metrics
        const avoidedWasteKg = Math.max(Math.round(predictedDemand * 0.28 + (100 - spoilagePercent) * 0.35), 12);
        const co2Kg = (avoidedWasteKg * 2.1).toFixed(1);
        const moneySaved = Math.round(avoidedWasteKg * 8.5);

        foodSavedKgEl.textContent = `${avoidedWasteKg} kg`;
        co2OffsetEl.textContent = `${co2Kg} kg`;
        costPreservedEl.textContent = `$${moneySaved}.00`;
    }

    // --- 3. Event Listeners for Simulator Inputs ---
    currentStockSlider.addEventListener('input', runXGBoostInference);
    footfallSlider.addEventListener('input', runXGBoostInference);
    shelfLifeSlider.addEventListener('input', runXGBoostInference);
    foodCategorySelect.addEventListener('change', () => {
        const opt = foodCategorySelect.options[foodCategorySelect.selectedIndex];
        shelfLifeSlider.value = opt.dataset.shelf;
        runXGBoostInference();
    });
    weatherRadios.forEach(radio => radio.addEventListener('change', runXGBoostInference));

    // Preset Scenario Handlers
    scenarioBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            scenarioBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDayScenario = btn.dataset.scenario;

            if (currentDayScenario === 'weekday') {
                footfallSlider.value = 650;
                document.querySelector('input[name="weather"][value="clear"]').checked = true;
            } else if (currentDayScenario === 'weekend') {
                footfallSlider.value = 950;
                document.querySelector('input[name="weather"][value="clear"]').checked = true;
            } else if (currentDayScenario === 'holiday') {
                footfallSlider.value = 1350;
                document.querySelector('input[name="weather"][value="hot"]').checked = true;
            } else if (currentDayScenario === 'rain') {
                footfallSlider.value = 350;
                document.querySelector('input[name="weather"][value="rain"]').checked = true;
            }

            runXGBoostInference();
        });
    });

    // Reset Defaults Button
    resetSimBtn.addEventListener('click', () => {
        foodCategorySelect.selectedIndex = 0;
        currentStockSlider.value = 240;
        footfallSlider.value = 650;
        shelfLifeSlider.value = 2;
        document.querySelector('input[name="weather"][value="clear"]').checked = true;
        scenarioBtns.forEach(b => b.classList.remove('active'));
        scenarioBtns[0].classList.add('active');
        currentDayScenario = 'weekday';
        runXGBoostInference();
    });

    // Run initial inference
    runXGBoostInference();

    // --- 4. Interactive Live Inventory Table ---
    const initialInventoryData = [
        { code: "SKU-8921", name: "Organic Baby Spinach & Kale", category: "Produce", stock: "140 kg", forecast: "135 kg", expiry: "2 Days", risk: "Low", status: "optimal", action: "Optimal Equilibrium" },
        { code: "SKU-4412", name: "Farm Fresh Pasteurized Milk", category: "Dairy", stock: "450 L", forecast: "380 L", expiry: "3 Days", risk: "Low", status: "optimal", action: "Schedule Routine Delivery" },
        { code: "SKU-3109", name: "Artisan Brioche Burger Buns", category: "Bakery", stock: "320 pk", forecast: "180 pk", expiry: "1 Day", risk: "High", status: "markdown", action: "Apply 30% Flash Markdown" },
        { code: "SKU-9920", name: "Mediterranean Chicken Bowl", category: "Meals", stock: "65 pk", forecast: "190 pk", expiry: "1 Day", risk: "Low", status: "reorder", action: "Trigger Express Reorder" },
        { code: "SKU-7741", name: "Fresh Atlantic Salmon Fillet", category: "Produce", stock: "80 kg", forecast: "75 kg", expiry: "2 Days", risk: "Low", status: "optimal", action: "Stock Balanced" },
        { code: "SKU-2208", name: "Greek Whole Milk Yogurt", category: "Dairy", stock: "210 cups", forecast: "90 cups", expiry: "2 Days", risk: "High", status: "decay-risk", action: "Redistribute to Campus Cafe" },
        { code: "SKU-1194", name: "Multi-Grain Baguettes", category: "Bakery", stock: "150 ea", forecast: "140 ea", expiry: "2 Days", risk: "Low", status: "optimal", action: "Optimal Equilibrium" },
        { code: "SKU-5532", name: "Vegan Protein Power Salads", category: "Meals", stock: "115 pk", forecast: "110 pk", expiry: "1 Day", risk: "Low", status: "optimal", action: "No Action Needed" }
    ];

    const inventoryTableBody = document.getElementById('inventoryTableBody');
    const inventorySearch = document.getElementById('inventorySearch');
    const tblFilterBtns = document.querySelectorAll('.tbl-filter-btn');
    const refreshTableBtn = document.getElementById('refreshTableBtn');

    let currentTableFilter = 'all';

    function renderTableRows(data) {
        inventoryTableBody.innerHTML = '';
        if (data.length === 0) {
            inventoryTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-muted);">No inventory matching filter criteria.</td></tr>`;
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="item-code">${item.code}</td>
                <td class="item-name">${item.name}</td>
                <td>${item.category}</td>
                <td><strong>${item.stock}</strong></td>
                <td>${item.forecast}</td>
                <td>${item.expiry}</td>
                <td><span class="badge-status ${item.status}">${item.risk} Risk</span></td>
                <td><span style="font-size: 0.82rem; color: #cbd5e1;">${item.action}</span></td>
            `;
            inventoryTableBody.appendChild(tr);
        });
    }

    function filterAndRenderTable() {
        const query = inventorySearch.value.toLowerCase().trim();
        const filtered = initialInventoryData.filter(item => {
            const matchesCategory = (currentTableFilter === 'all' || item.category.toLowerCase() === currentTableFilter.toLowerCase());
            const matchesQuery = item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
            return matchesCategory && matchesQuery;
        });
        renderTableRows(filtered);
    }

    inventorySearch.addEventListener('input', filterAndRenderTable);

    tblFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tblFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTableFilter = btn.dataset.filter;
            filterAndRenderTable();
        });
    });

    // Refresh button simulation
    refreshTableBtn.addEventListener('click', () => {
        const originalContent = refreshTableBtn.innerHTML;
        refreshTableBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate fa-spin"></i> <span>Processing Spark DAG...</span>';
        refreshTableBtn.disabled = true;

        setTimeout(() => {
            // Randomly modulate quantities slightly to show live streaming updates
            initialInventoryData.forEach(item => {
                const delta = Math.floor(Math.random() * 9) - 4;
                const currentVal = parseInt(item.stock, 10);
                if (currentVal + delta > 10) {
                    item.stock = `${currentVal + delta} ${item.stock.split(' ')[1] || 'units'}`;
                }
            });
            filterAndRenderTable();
            refreshTableBtn.innerHTML = originalContent;
            refreshTableBtn.disabled = false;
        }, 800);
    });

    renderTableRows(initialInventoryData);

    // --- 5. Pipeline Step Explorer ---
    const pipelineSteps = document.querySelectorAll('.pipeline-step');
    const stepBadge = document.getElementById('stepBadge');
    const stepTitle = document.getElementById('stepTitle');
    const stepMetric = document.getElementById('stepMetric');
    const stepDescription = document.getElementById('stepDescription');
    const termFile = document.getElementById('termFile');
    const termCode = document.getElementById('termCode');

    const stepData = {
        "1": {
            badge: "STAGE 01",
            title: "IoT & Dining Telemetry Ingestion Layer",
            metric: "Throughput: 14,200 events/sec",
            desc: "Captures real-time stock deductions directly from campus dining RFID points of sale, temperature chillers, and daily academic calendar feeds.",
            file: "telemetry_consumer.py",
            code: `# Kafka stream consumer piping sensor metrics into HDFS
from pyspark.sql import SparkSession
spark = SparkSession.builder.appName("FoodFlowIngestion").getOrCreate()
raw_stream = spark.readStream.format("kafka").option("subscribe", "dining-inventory").load()`
        },
        "2": {
            badge: "STAGE 02",
            title: "Hadoop HDFS Fault-Tolerant Storage",
            metric: "Storage: 1.4M Historical Rows",
            desc: "Stores raw and partitioned historical transactions across redundant datanodes, enabling distributed multi-year decay pattern analysis.",
            file: "hdfs_storage_manager.py",
            code: `# HDFS partition verification and Parquet archival
def archive_to_hdfs(df, date_str):
    hdfs_path = f"hdfs://namenode:9000/data/warehouse/inventory/dt={date_str}"
    df.write.mode("append").parquet(hdfs_path)
    print(f"[HDFS] Stored partition: {hdfs_path}")`
        },
        "3": {
            badge: "STAGE 03",
            title: "Apache Spark Distributed ETL & Feature Engineering",
            metric: "ETL Time: 42ms per micro-batch",
            desc: "Computes exponential moving averages, shelf-life degradation curves, weather-demand correlations, and prepares training matrices in RAM.",
            file: "spark_feature_extractor.py",
            code: `# Compute rolling averages and lag features in Apache Spark
from pyspark.sql.window import Window
import pyspark.sql.functions as F

w = Window.partitionBy("item_sku").orderBy("timestamp").rowsBetween(-7, 0)
feature_df = raw_df.withColumn("rolling_7d_demand", F.avg("units_consumed").over(w)) \\
                   .withColumn("decay_index", F.col("hours_to_expiry") / 24.0)`
        },
        "4": {
            badge: "STAGE 04",
            title: "XGBoost Machine Learning Inference Engine",
            metric: "Evaluation: 99.1% R² Accuracy",
            desc: "Gradient-boosted decision trees trained with depth optimization and early stopping to predict exact unit demand and decay thresholds.",
            file: "xgboost_model_engine.py",
            code: `import xgboost as xgb
model = xgb.XGBRegressor(n_estimators=350, max_depth=6, learning_rate=0.03, subsample=0.85)
model.fit(X_train, y_train, eval_set=[(X_val, y_val)], early_stopping_rounds=20)
preds = model.predict(X_test)
print(f"XGBoost Test R² Score: {r2_score(y_test, preds):.4f}")  # 0.9912`
        },
        "5": {
            badge: "STAGE 05",
            title: "Action Dispatch & Automated Procurement",
            metric: "Waste Mitigation: 45.0% Achieved",
            desc: "Transmits real-time actionable directives: electronic purchase requisitions to vendors, flash discounts on campus apps, and food bank dispatch alerts.",
            file: "action_dispatcher.py",
            code: `def dispatch_inventory_directive(decision):
    if decision["risk"] == "HIGH_DECAY":
        send_flash_markdown_event(sku=decision["sku"], discount_pct=30)
    elif decision["risk"] == "UNDERSTOCK":
        trigger_erp_purchase_order(sku=decision["sku"], units=decision["reorder_qty"])`
        }
    };

    pipelineSteps.forEach(step => {
        step.addEventListener('click', () => {
            pipelineSteps.forEach(s => s.classList.remove('active'));
            step.classList.add('active');

            const id = step.dataset.step;
            const data = stepData[id];
            if (data) {
                stepBadge.textContent = data.badge;
                stepTitle.textContent = data.title;
                stepMetric.textContent = data.metric;
                stepDescription.textContent = data.desc;
                termFile.textContent = data.file;
                termCode.textContent = data.code;
            }
        });
    });
});
