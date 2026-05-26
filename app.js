/* ==========================================
   PIGGYVAULT MASTER ENGINE - LOCAL STORAGE & DYNAMICS
   ========================================== */

// Database Structure holding global state and kid profiles
const DEFAULT_DATABASE = {
  activeKid: 'linheng',
  parentPin: '1349',
  timeWarpActive: false,
  balanceVersion: 11,
  profiles: {
    linheng: {
      name: 'Linheng',
      avatar: '🐷',
      theme: 'linheng',
      balance: 684.00,
      interestRate: 5, // 5% APR
      totalInterest: 0.00,
      completedQuests: 0,
      goals: [], // Clear all wishlist items
      chores: [], // Clean slate quest board
      lastAllowanceDate: "2026-05-25T12:00:00Z",
      lastInterestDate: null,
      transactions: [
        { id: 101, type: "deposit", amount: 684.00, desc: "Pocket savings foundation", date: "2026-05-25T12:00:00Z" }
      ]
    },
    yitong: {
      name: 'Yitong',
      avatar: '😈',
      theme: 'yitong',
      balance: 702.86,
      interestRate: 5, // 5% APR
      totalInterest: 0.00,
      completedQuests: 0,
      goals: [], // Clear all wishlist items
      chores: [], // Clean slate quest board
      lastAllowanceDate: "2026-05-25T12:00:00Z",
      lastInterestDate: null,
      transactions: [
        { id: 201, type: "deposit", amount: 702.86, desc: "Pocket savings foundation", date: "2026-05-25T12:00:00Z" }
      ]
    }
  }
};

let db = null;
let currentPinInput = "";
let forecastChartInstance = null;
let forecastChartKidInstance = null;
let timeWarpInterval = null;
let realTimeInterestInterval = null;

// Piggy Speech tips array
const PIGGY_TIPS = [
  "Clink! Saving early makes you super smart!",
  "Pro Tip: Setting Goals helps you save faster!",
  "Did you know? Compound interest is like free money!",
  "Make sure to complete your chore quests to earn rewards!",
  "Let's see what is on Yitong's wishlist today!",
  "Every single penny saved fills up your PiggyVault!",
  "Ask Mom or Dad to set a high interest rate for big returns!"
];

/* ==========================================
   APP INITIALIZATION
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
  initDatabase();
  renderApp();
  startRealTimeInterest();
  
  // Set default form selections
  adjustTransferRecipients('sender');
  
  // Clear template active highlights if kid manually types custom values
  const nameInput = document.getElementById("proposedChoreName");
  const rewardInput = document.getElementById("proposedChoreReward");
  if (nameInput && rewardInput) {
    const clearActiveChips = () => {
      const chips = document.querySelectorAll("#proposeChoreModal .suggestion-chip");
      chips.forEach(chip => chip.classList.remove("active"));
    };
    nameInput.addEventListener("input", clearActiveChips);
    rewardInput.addEventListener("input", clearActiveChips);
  }

  // Check date and deposit daily allowance and interest retrospectively on boot
  checkAndDepositAllowance();
  checkAndDepositDailyInterest();

  // Periodically check every 60 seconds (for midnight allowance and 6 PM interest rollover support)
  setInterval(() => {
    checkAndDepositAllowance();
    checkAndDepositDailyInterest();
  }, 60000);
});

// Load database from localStorage or seed default
function initDatabase() {
  const localData = localStorage.getItem("piggyvault_db");
  if (localData) {
    try {
      db = JSON.parse(localData);
      
      // Force update stored parent PIN to new requested '1349'
      db.parentPin = '1349';
      
      // Ensure safety check for profiles structure
      if (!db.profiles || !db.profiles.linheng || !db.profiles.yitong) {
        throw new Error("Invalid structure");
      }
      
      // Force database reset to version 11: clears test entries, resets balances to initial pockets, and sets up 6 PM daily interest tracking
      if (db.balanceVersion !== 11) {
        db.balanceVersion = 11;
        
        const now = new Date();
        let initialLastInterest = new Date(now);
        initialLastInterest.setHours(18, 0, 0, 0); // 6:00 PM
        if (initialLastInterest.getTime() > now.getTime()) {
          // 6 PM today is in the future, so seed to 6 PM yesterday
          initialLastInterest.setTime(initialLastInterest.getTime() - 24 * 60 * 60 * 1000);
        }
        const initialInterestDateStr = initialLastInterest.toISOString();

        db.profiles.linheng.balance = 684.00;
        db.profiles.linheng.avatar = '🐷';
        db.profiles.linheng.interestRate = 5;
        db.profiles.linheng.totalInterest = 0.00;
        db.profiles.linheng.completedQuests = 0;
        db.profiles.linheng.goals = [];
        db.profiles.linheng.chores = [];
        db.profiles.linheng.lastAllowanceDate = new Date().toISOString();
        db.profiles.linheng.lastInterestDate = initialInterestDateStr;
        db.profiles.linheng.transactions = [
          { id: 101, type: "deposit", amount: 684.00, desc: "Pocket savings foundation", date: "2026-05-25T12:00:00Z" }
        ];
        
        db.profiles.yitong.balance = 702.86;
        db.profiles.yitong.avatar = '😈';
        db.profiles.yitong.interestRate = 5;
        db.profiles.yitong.totalInterest = 0.00;
        db.profiles.yitong.completedQuests = 0;
        db.profiles.yitong.goals = [];
        db.profiles.yitong.chores = [];
        db.profiles.yitong.lastAllowanceDate = new Date().toISOString();
        db.profiles.yitong.lastInterestDate = initialInterestDateStr;
        db.profiles.yitong.transactions = [
          { id: 201, type: "deposit", amount: 702.86, desc: "Pocket savings foundation", date: "2026-05-25T12:00:00Z" }
        ];
      }
      saveDatabase();
    } catch (e) {
      console.warn("Re-seeding database due to corrupt storage", e);
      db = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
      saveDatabase();
    }
  } else {
    db = JSON.parse(JSON.stringify(DEFAULT_DATABASE));
    saveDatabase();
  }

  // Handle active timers if page reloaded with TimeWarp checked
  if (db.timeWarpActive) {
    startTimeWarp();
  }
}

// Synchronize database to local storage
function saveDatabase() {
  localStorage.setItem("piggyvault_db", JSON.stringify(db));
}

/* ==========================================
   VISUAL RENDER BINDERS
   ========================================== */
function renderApp() {
  const activeKid = db.activeKid;
  const profile = db.profiles[activeKid];

  // Update design system CSS Custom properties to trigger kid theme
  document.documentElement.style.setProperty('--accent-primary', `var(--${profile.theme}-primary)`);
  document.documentElement.style.setProperty('--accent-secondary', `var(--${profile.theme}-secondary)`);
  document.documentElement.style.setProperty('--accent-glow', `var(--${profile.theme}-glow)`);

  // Update main stats elements
  document.getElementById("kidNameBadge").innerText = `${profile.name}'s Vault`;
  document.getElementById("currentBalanceDisplay").innerText = formatCurrency(profile.balance);
  document.getElementById("currentRateDisplay").innerText = `${profile.interestRate}%`;
  document.getElementById("totalInterestDisplay").innerText = `+${formatCurrency(profile.totalInterest)}`;
  document.getElementById("completedQuestsDisplay").innerText = profile.completedQuests;

  // Header active profile tab toggle state
  const tabs = document.querySelectorAll(".profile-tab");
  tabs.forEach(tab => {
    if (tab.dataset.kid === activeKid) {
      tab.classList.add("active");
    } else {
      tab.classList.remove("active");
    }
  });

  // Render components
  renderGoalsList(profile);
  renderQuestsList(profile);
  renderTransactionsList(profile);
  updatePiggyVisualFill(profile);

  // Sync parent settings view values in case it is open
  document.getElementById("parentKidSelector").value = activeKid;
  document.getElementById("interestRateSlider").value = profile.interestRate;
  document.getElementById("interestRateVal").innerText = `${profile.interestRate}%`;
  document.getElementById("chartForecastTarget").innerText = profile.name;
  
  updateFamilyTotalDisplay();
  
  // If the Money Growth tab is active in Kid Mode, redraw the Kid Chart!
  if (document.getElementById("growthTabContent").classList.contains("active")) {
    renderKidGrowthChart();
  }
  
  if (document.getElementById("parentView").classList.contains("hidden") === false) {
    renderParentApprovals();
    renderGrowthChart();
  }
}

// Updates Piggy Bank Inner Liquid Fill Level
function updatePiggyVisualFill(profile) {
  // Let's find the progress level based on the closest savings goal target
  let fillPercentage = 25; // Default cute minimum liquid level
  
  if (profile.goals && profile.goals.length > 0) {
    // Sort goals by cost ascending and find the first incomplete or highest progress
    const activeGoals = [...profile.goals];
    activeGoals.sort((a,b) => a.cost - b.cost);
    
    // Find closest goal we are saving towards
    const targetGoal = activeGoals[0];
    if (targetGoal.cost > 0) {
      const progress = (profile.balance / targetGoal.cost) * 100;
      // Clamp between 10% and 95% so pig looks filled but neat
      fillPercentage = Math.min(Math.max(progress, 15), 90);
    }
  } else {
    // If no goals, use default scaling up to $200 savings
    const progress = (profile.balance / 200) * 100;
    fillPercentage = Math.min(Math.max(progress, 15), 90);
  }

  // Clip Path calculation: inset(H 0 0 0) - H represents hidden top %
  // Thus, a 40% fill means 60% is hidden from the top.
  const hiddenTopPercent = 100 - fillPercentage;
  
  const fillNode = document.getElementById("piggyVisualFill");
  if (fillNode) {
    fillNode.style.clipPath = `inset(${hiddenTopPercent}% 0 0 0)`;
  }
}

// Format number to local money display
function formatCurrency(val) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(val);
}

/* ==========================================
   WISHLIST SAVINGS GOAL BOARD
   ========================================== */
function renderGoalsList(profile) {
  const container = document.getElementById("goalsList");
  container.innerHTML = "";

  if (!profile.goals || profile.goals.length === 0) {
    container.innerHTML = `
      <div class="no-pending-chores" style="padding: 24px;">
        <i class="fa-solid fa-gift" style="color: var(--accent-primary); font-size: 24px;"></i>
        <p style="font-size: 13px;">No wishlist goals set yet! Add a goal using the button above to start your savings journey.</p>
      </div>
    `;
    return;
  }

  profile.goals.forEach(goal => {
    const isFunded = profile.balance >= goal.cost;
    const isCompleted = goal.status === "completed";
    const isPending = goal.status === "pending_purchase";

    const percentage = (isCompleted || isPending) ? 100 : Math.min(Math.round((profile.balance / goal.cost) * 100), 100);
    const amountNeeded = (isCompleted || isPending) ? 0 : Math.max(goal.cost - profile.balance, 0);
    
    let itemIcon = "fa-gift";
    if (goal.category === "gamepad") itemIcon = "fa-gamepad";
    if (goal.category === "lego") itemIcon = "fa-puzzle-piece";
    if (goal.category === "bicycle") itemIcon = "fa-bicycle";
    if (goal.category === "music") itemIcon = "fa-music";
    if (goal.category === "book") itemIcon = "fa-book-open";
    if (goal.category === "laptop") itemIcon = "fa-laptop";

    let completedBadge = "";
    let goalStatusText = `Need ${formatCurrency(amountNeeded)} more`;
    
    if (isCompleted) {
      completedBadge = `<span class="goal-completed-seal purchased"><i class="fa-solid fa-circle-check"></i> Purchased!</span>`;
      goalStatusText = `🎉 Bought by Mom & Dad!`;
    } else if (isPending) {
      completedBadge = `<span class="goal-completed-seal pending"><i class="fa-solid fa-spinner fa-spin"></i> Reviewing</span>`;
      goalStatusText = `⏳ Awaiting parent approval...`;
    } else if (isFunded) {
      completedBadge = `<span class="goal-completed-seal achieved">Funded!</span>`;
      goalStatusText = `<button class="claim-purchase-btn" onclick="requestGoalPurchase(${goal.id})"><i class="fa-solid fa-cart-shopping"></i> Claim Purchase!</button>`;
    }

    const card = document.createElement("div");
    card.className = `goal-item ${isCompleted ? 'goal-completed' : ''}`;
    card.innerHTML = `
      ${completedBadge}
      <div class="goal-item-icon">
        <i class="fa-solid ${itemIcon}"></i>
      </div>
      <div class="goal-item-details">
        <div class="goal-title-row">
          <span class="goal-title">${goal.name}</span>
          <button class="delete-goal-btn" title="Delete Goal" onclick="deleteWishlistGoal(${goal.id})">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
        <div class="goal-prices">
          Progress: <strong>${formatCurrency(isCompleted ? goal.cost : Math.min(profile.balance, goal.cost))}</strong> of <strong>${formatCurrency(goal.cost)}</strong>
        </div>
        <div class="goal-progress-container">
          <div class="progress-track">
            <div class="progress-bar" style="width: ${percentage}%"></div>
          </div>
        </div>
        <div class="goal-meta-row">
          <span style="display: flex; align-items: center; width: 100%; justify-content: space-between; gap: 8px;">
            <span>${goalStatusText}</span>
            <span class="goal-percentage">${percentage}%</span>
          </span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function showAddGoalModal() {
  document.getElementById("addGoalModal").classList.remove("hidden");
}

function closeAddGoalModal() {
  document.getElementById("addGoalModal").classList.add("hidden");
  document.getElementById("newGoalName").value = "";
  document.getElementById("newGoalCost").value = "";
}

function saveNewWishlistGoal() {
  const nameInput = document.getElementById("newGoalName").value.trim();
  const costInput = parseFloat(document.getElementById("newGoalCost").value);
  const catInput = document.getElementById("newGoalCategory").value;

  if (!nameInput || isNaN(costInput) || costInput <= 0) {
    showToast("Warning", "Please enter a valid name and price for your goal!", "warning");
    return;
  }

  const activeKid = db.activeKid;
  const profile = db.profiles[activeKid];

  const newGoal = {
    id: Date.now(),
    name: nameInput,
    cost: costInput,
    category: catInput,
    status: "saving"
  };

  profile.goals.push(newGoal);
  saveDatabase();
  renderApp();
  closeAddGoalModal();
  showToast("Goal Created!", `Added "${nameInput}" to your wishlist. Let's start saving!`, "success");
}

function deleteWishlistGoal(goalId) {
  const activeKid = db.activeKid;
  const profile = db.profiles[activeKid];
  
  profile.goals = profile.goals.filter(goal => goal.id !== goalId);
  saveDatabase();
  renderApp();
  showToast("Goal Removed", "Wishlist goal has been removed.", "info");
}

function requestGoalPurchase(goalId) {
  const activeKid = db.activeKid;
  const profile = db.profiles[activeKid];
  
  const goalIndex = profile.goals.findIndex(g => g.id === goalId);
  if (goalIndex !== -1) {
    profile.goals[goalIndex].status = "pending_purchase";
    saveDatabase();
    renderApp();
    showToast("Purchase Claimed!", `Claim request for "${profile.goals[goalIndex].name}" sent to Mom and Dad!`, "success");
  }
}

/* ==========================================
   QUEST BOARD (CHORES & TASKS)
   ========================================== */
function renderQuestsList(profile) {
  const container = document.getElementById("choresList");
  container.innerHTML = "";

  const activeChores = profile.chores.filter(c => c.status !== "completed");
  
  if (activeChores.length === 0) {
    container.innerHTML = `
      <div class="no-pending-chores">
        <i class="fa-solid fa-circle-check text-green"></i>
        <p>Hooray! You've cleared all assigned chores. Ask Mom and Dad for new quests!</p>
      </div>
    `;
    return;
  }

  activeChores.forEach(chore => {
    const item = document.createElement("div");
    item.className = "chore-item";
    
    let actionArea = "";
    if (chore.status === "active") {
      actionArea = `<button class="chore-action-btn" onclick="submitChoreForApproval(${chore.id})">Mark Done</button>`;
    } else if (chore.status === "pending_approval") {
      actionArea = `<span class="chore-status-pending"><i class="fa-solid fa-spinner fa-spin"></i> Reviewing</span>`;
    } else if (chore.status === "proposed") {
      actionArea = `<span class="chore-status-proposed"><i class="fa-solid fa-clock"></i> Awaiting Payout</span>`;
    }

    item.innerHTML = `
      <div class="chore-details">
        <div class="chore-name">${chore.name}</div>
        <div class="chore-reward-tag">
          <i class="fa-solid fa-coins"></i> +${formatCurrency(chore.reward)} Reward
        </div>
      </div>
      <div class="chore-actions">
        ${actionArea}
      </div>
    `;
    container.appendChild(item);
  });
}

function submitChoreForApproval(choreId) {
  const activeKid = db.activeKid;
  const profile = db.profiles[activeKid];
  
  const choreIndex = profile.chores.findIndex(c => c.id === choreId);
  if (choreIndex !== -1) {
    profile.chores[choreIndex].status = "pending_approval";
    saveDatabase();
    renderApp();
    showToast("Quest Completed!", "Chore submitted to Parent Portal for approval. Nice job!", "success");
  }
}

function showProposeChoreModal() {
  document.getElementById("proposeChoreModal").classList.remove("hidden");
}

function closeProposeChoreModal() {
  document.getElementById("proposeChoreModal").classList.add("hidden");
  document.getElementById("proposedChoreName").value = "";
  document.getElementById("proposedChoreReward").value = "";
  
  // Clear any active suggestion chip states
  const chips = document.querySelectorAll("#proposeChoreModal .suggestion-chip");
  chips.forEach(chip => chip.classList.remove("active"));
}

/* ==========================================
   QUEST PROPOSAL TEMPLATE CLICK HANDLER
   ========================================== */
function selectProposalSuggestion(name, reward, clickedElement) {
  const nameInput = document.getElementById("proposedChoreName");
  const rewardInput = document.getElementById("proposedChoreReward");
  
  if (nameInput && rewardInput) {
    // Drop the icon emoji prefix from description to keep input clean or include it depending on style
    nameInput.value = name;
    rewardInput.value = reward.toFixed(2);
    
    // Manage active states
    const chips = document.querySelectorAll("#proposeChoreModal .suggestion-chip");
    chips.forEach(chip => chip.classList.remove("active"));
    
    if (clickedElement) {
      clickedElement.classList.add("active");
    }
  }
}

function submitProposedChore() {
  const nameInput = document.getElementById("proposedChoreName").value.trim();
  const rewardInput = parseFloat(document.getElementById("proposedChoreReward").value);

  if (!nameInput || isNaN(rewardInput) || rewardInput <= 0) {
    showToast("Warning", "Please provide a description and reward for your suggested quest!", "warning");
    return;
  }

  const activeKid = db.activeKid;
  const profile = db.profiles[activeKid];

  const newChore = {
    id: Date.now(),
    name: nameInput,
    reward: rewardInput,
    status: "proposed"
  };

  profile.chores.push(newChore);
  saveDatabase();
  renderApp();
  closeProposeChoreModal();
  showToast("Quest Suggested!", `Quest proposal "${nameInput}" sent to Mom and Dad for review.`, "success");
}

/* ==========================================
   VAULT HISTORY (TRANSACTION LOGS)
   ========================================== */
function renderTransactionsList(profile) {
  const container = document.getElementById("transactionList");
  container.innerHTML = "";

  // Make a shallow copy and reverse to show newest first
  const txHistory = [...profile.transactions].reverse();

  if (txHistory.length === 0) {
    container.innerHTML = `
      <div class="no-pending-chores" style="padding: 24px;">
        <i class="fa-solid fa-receipt" style="color: var(--accent-primary); font-size: 24px;"></i>
        <p>No transactions registered yet. Complete chores to receive coins!</p>
      </div>
    `;
    return;
  }

  txHistory.forEach(tx => {
    const item = document.createElement("div");
    item.className = "tx-item";

    let txIcon = '<i class="fa-solid fa-circle-down"></i>';
    let txIconClass = "deposit";
    let sign = "+";
    let signClass = "plus";

    if (tx.type === "withdraw") {
      txIcon = '<i class="fa-solid fa-circle-up"></i>';
      txIconClass = "withdraw";
      sign = "-";
      signClass = "minus";
    } else if (tx.type === "transfer") {
      txIcon = '<i class="fa-solid fa-right-left"></i>';
      txIconClass = "transfer";
      sign = tx.amount >= 0 ? "+" : ""; // Sibling transfers can be +/- representation
      signClass = tx.amount >= 0 ? "plus" : "minus";
    }

    const txDate = new Date(tx.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    item.innerHTML = `
      <div class="tx-left">
        <div class="tx-icon ${txIconClass}">
          ${txIcon}
        </div>
        <div class="tx-details">
          <span class="tx-desc">${tx.desc}</span>
          <span class="tx-date">${txDate}</span>
        </div>
      </div>
      <div class="tx-amount ${signClass}">
        ${sign}${formatCurrency(Math.abs(tx.amount))}
      </div>
    `;
    container.appendChild(item);
  });
}

/* ==========================================
   KIDS PROFILE TAB SWITCHING
   ========================================== */
function switchKidProfile(kidId) {
  if (db.activeKid === kidId) return;
  db.activeKid = kidId;
  saveDatabase();
  renderApp();
  
  // Wiggle the piggy bank as a cute welcome effect
  setTimeout(() => {
    triggerPiggyWiggle();
  }, 100);
}

// Tab navigation within the kid's dashboard right-side card
function switchRightTab(tabType) {
  const questsBtn = document.getElementById("questsTabBtn");
  const historyBtn = document.getElementById("historyTabBtn");
  const growthBtn = document.getElementById("growthTabBtn");
  
  const questsContent = document.getElementById("questsTabContent");
  const historyContent = document.getElementById("historyTabContent");
  const growthContent = document.getElementById("growthTabContent");

  // Deactivate all
  questsBtn.classList.remove("active");
  historyBtn.classList.remove("active");
  growthBtn.classList.remove("active");
  questsContent.classList.remove("active");
  historyContent.classList.remove("active");
  growthContent.classList.remove("active");

  if (tabType === 'quests') {
    questsBtn.classList.add("active");
    questsContent.classList.add("active");
  } else if (tabType === 'history') {
    historyBtn.classList.add("active");
    historyContent.classList.add("active");
  } else if (tabType === 'growth') {
    growthBtn.classList.add("active");
    growthContent.classList.add("active");
    // Draw/Refresh Kid Chart when tab is opened
    renderKidGrowthChart();
  }
}

// Trigger micro piggy wiggling & speech bubbles
function triggerPiggyWiggle() {
  const piggy = document.getElementById("piggyClickTarget");
  if (!piggy) return;

  piggy.classList.add("wiggle");
  setTimeout(() => {
    piggy.classList.remove("wiggle");
  }, 500);

  // Custom visual coin explosion
  spawnCoinParticles();

  // Pick random speech bubble text
  const bubble = document.getElementById("speechBubble");
  const randomTip = PIGGY_TIPS[Math.floor(Math.random() * PIGGY_TIPS.length)];
  bubble.innerText = randomTip;
  
  // Highlight bubble
  bubble.style.transform = "translateY(-4px) scale(1.05)";
  setTimeout(() => {
    bubble.style.transform = "none";
  }, 400);
}

// Particle effect on Piggy click
function spawnCoinParticles() {
  const stream = document.getElementById("coinStream");
  if (!stream) return;

  for (let i = 0; i < 3; i++) {
    const coin = document.createElement("div");
    coin.className = "falling-coin";
    coin.style.left = `${40 + Math.random() * 20}%`;
    coin.style.animationDelay = `${i * 0.1}s`;
    stream.appendChild(coin);

    // Self cleanup
    setTimeout(() => {
      coin.remove();
    }, 850);
  }
}

/* ==========================================
   PARENT PORTAL ENTER/EXIT KEYPAD GATE
   ========================================== */
function openParentModal() {
  currentPinInput = "";
  updatePinDots();
  document.getElementById("pinErrorAlert").classList.add("hidden");
  document.getElementById("parentPinModal").classList.remove("hidden");
}

function closeParentModal() {
  document.getElementById("parentPinModal").classList.add("hidden");
}

function pressPinNumber(num) {
  if (currentPinInput.length >= 4) return;
  currentPinInput += num;
  updatePinDots();
  
  // Auto submit when 4 digits reached
  if (currentPinInput.length === 4) {
    setTimeout(() => {
      submitParentPin();
    }, 150);
  }
}

function clearPinNumber() {
  currentPinInput = "";
  updatePinDots();
  document.getElementById("pinErrorAlert").classList.add("hidden");
}

function updatePinDots() {
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (i <= currentPinInput.length) {
      dot.classList.add("filled");
    } else {
      dot.classList.remove("filled");
    }
  }
}

function submitParentPin() {
  if (currentPinInput === db.parentPin) {
    // PIN correct! Unlock Portal
    closeParentModal();
    enterParentPortal();
  } else {
    // PIN incorrect
    currentPinInput = "";
    updatePinDots();
    
    const alertBox = document.getElementById("pinErrorAlert");
    alertBox.classList.remove("hidden");
    
    // Add shake effect to pin card
    const pinCard = document.querySelector(".pin-card");
    pinCard.style.animation = "none";
    setTimeout(() => {
      pinCard.style.animation = "wiggler 0.4s ease";
    }, 5);
  }
}

function enterParentPortal() {
  // Hide Kids mode layout, display parent view
  document.getElementById("kidView").classList.add("hidden");
  document.getElementById("parentView").classList.remove("hidden");
  
  // Sync values
  renderParentApprovals();
  updateFamilyTotalDisplay();
  renderGrowthChart();
  
  showToast("Portal Unlocked", "Welcome to Parent Control room.", "success");
}

function exitParentPortal() {
  document.getElementById("parentView").classList.add("hidden");
  document.getElementById("kidView").classList.remove("hidden");
  renderApp();
}

function updateFamilyTotalDisplay() {
  const sum = db.profiles.linheng.balance + db.profiles.yitong.balance;
  document.getElementById("familyTotalDisplay").innerText = formatCurrency(sum);
}

/* ==========================================
   PARENT PORTAL LEDGER ACTIONS
   ========================================== */

// Sync active selected kid inside Parent view controls
function parentSelectKidChange() {
  const selectedKid = document.getElementById("parentKidSelector").value;
  db.activeKid = selectedKid;
  saveDatabase();
  
  // Sync slider and rate text
  const profile = db.profiles[selectedKid];
  document.getElementById("interestRateSlider").value = profile.interestRate;
  document.getElementById("interestRateVal").innerText = `${profile.interestRate}%`;
  document.getElementById("chartForecastTarget").innerText = profile.name;

  // Redraw Graph & Chores
  renderGrowthChart();
  renderParentApprovals();
}

// Executes deposits and withdrawals
function executeManualLedger(actionType) {
  const selectedKid = document.getElementById("parentKidSelector").value;
  const amountInput = parseFloat(document.getElementById("adjustmentAmount").value);
  const noteInput = document.getElementById("adjustmentNote").value.trim();

  if (isNaN(amountInput) || amountInput <= 0) {
    showToast("Invalid Ledger Input", "Please enter a valid dollar amount.", "warning");
    return;
  }

  const profile = db.profiles[selectedKid];
  const finalNote = noteInput || (actionType === 'deposit' ? 'Parent Cash Bonus' : 'Manual Expense Cashout');

  if (actionType === 'withdraw' && profile.balance < amountInput) {
    showToast("Overdraft Blocked", `${profile.name} does not have enough coins for this withdrawal!`, "warning");
    return;
  }

  // Adjust balance
  if (actionType === 'deposit') {
    profile.balance += amountInput;
  } else {
    profile.balance -= amountInput;
  }

  // Record Transaction
  const newTx = {
    id: Date.now(),
    type: actionType,
    amount: actionType === 'deposit' ? amountInput : -amountInput,
    desc: finalNote,
    date: new Date().toISOString()
  };
  profile.transactions.push(newTx);

  saveDatabase();
  renderApp();
  
  // Clear inputs
  document.getElementById("adjustmentAmount").value = "";
  document.getElementById("adjustmentNote").value = "";

  showToast("Ledger Updated", `${actionType === 'deposit' ? 'Added' : 'Deducted'} ${formatCurrency(amountInput)} for ${profile.name}!`, "success");
}

/* ==========================================
   SIBLING SHIELD MONEY TRANSFER
   ========================================== */

// Make sure children don't transfer to themselves
function adjustTransferRecipients(changedRole) {
  const senderVal = document.getElementById("transferSender").value;
  const receiverVal = document.getElementById("transferReceiver").value;

  if (senderVal === receiverVal) {
    if (changedRole === 'sender') {
      document.getElementById("transferReceiver").value = senderVal === 'linheng' ? 'yitong' : 'linheng';
    } else {
      document.getElementById("transferSender").value = receiverVal === 'linheng' ? 'yitong' : 'linheng';
    }
  }
}

function executeSiblingTransfer() {
  const senderId = document.getElementById("transferSender").value;
  const receiverId = document.getElementById("transferReceiver").value;
  const amountInput = parseFloat(document.getElementById("transferAmount").value);

  if (isNaN(amountInput) || amountInput <= 0) {
    showToast("Error", "Please input a valid transfer amount.", "warning");
    return;
  }

  const sender = db.profiles[senderId];
  const receiver = db.profiles[receiverId];

  if (sender.balance < amountInput) {
    showToast("Transfer Blocked", `${sender.name} only has ${formatCurrency(sender.balance)}. Cannot send ${formatCurrency(amountInput)}!`, "warning");
    return;
  }

  // Complete transfer bookkeeping
  sender.balance -= amountInput;
  receiver.balance += amountInput;

  const dateString = new Date().toISOString();

  // Transaction for Sender
  sender.transactions.push({
    id: Date.now() + 1,
    type: "transfer",
    amount: -amountInput,
    desc: `Shared money transfer to ${receiver.name}`,
    date: dateString
  });

  // Transaction for Receiver
  receiver.transactions.push({
    id: Date.now() + 2,
    type: "transfer",
    amount: amountInput,
    desc: `Received shared money from ${sender.name}`,
    date: dateString
  });

  saveDatabase();
  renderApp();

  document.getElementById("transferAmount").value = "";
  showToast("Transfer Successful!", `Sent ${formatCurrency(amountInput)} from ${sender.name} to ${receiver.name}!`, "success");
}

/* ==========================================
   PARENT PORTAL ADMIN RESET CONTROL
   ========================================== */
function confirmResetVault() {
  if (confirm("⚠️ WARNING: This will permanently delete all vault transaction history, complete chores, and reset Linheng's balance to $684.00 and Yitong's balance to $702.86. This cannot be undone! Are you sure?")) {
    // Reset database to initial seeds
    db.profiles.linheng.balance = 684.00;
    db.profiles.linheng.totalInterest = 0.00;
    db.profiles.linheng.completedQuests = 0;
    db.profiles.linheng.goals = [];
    db.profiles.linheng.chores = [];
    db.profiles.linheng.lastAllowanceDate = new Date().toISOString();
    db.profiles.linheng.transactions = [
      { id: 101, type: "deposit", amount: 684.00, desc: "Pocket savings foundation", date: new Date().toISOString() }
    ];
    
    db.profiles.yitong.balance = 702.86;
    db.profiles.yitong.totalInterest = 0.00;
    db.profiles.yitong.completedQuests = 0;
    db.profiles.yitong.goals = [];
    db.profiles.yitong.chores = [];
    db.profiles.yitong.lastAllowanceDate = new Date().toISOString();
    db.profiles.yitong.transactions = [
      { id: 201, type: "deposit", amount: 702.86, desc: "Pocket savings foundation", date: new Date().toISOString() }
    ];
    
    // Save database and refresh
    saveDatabase();
    renderApp();
    showToast("Vault Reset Completed", "All balances reset and history cleared!", "success");
    
    // Return back to kids mode to see the refreshed clean states!
    setTimeout(() => {
      exitParentPortal();
    }, 1500);
  }
}

/* ==========================================
   PARENT PORTAL CHORE APPROVALS BOARD
   ========================================== */
function renderParentApprovals() {
  const container = document.getElementById("parentApprovalsQueue");
  container.innerHTML = "";

  let pendingList = [];

  // Check both profiles for pending completed tasks, newly proposed tasks, and goal purchase claims
  ['linheng', 'yitong'].forEach(kidId => {
    const kid = db.profiles[kidId];
    
    // 1. Chores
    kid.chores.forEach(chore => {
      if (chore.status === "pending_approval" || chore.status === "proposed") {
        pendingList.push({
          type: "chore",
          kidId: kidId,
          kidName: kid.name,
          choreId: chore.id,
          name: chore.name,
          reward: chore.reward,
          status: chore.status
        });
      }
    });

    // 2. Goal claims
    if (kid.goals) {
      kid.goals.forEach(goal => {
        if (goal.status === "pending_purchase") {
          pendingList.push({
            type: "goal_claim",
            kidId: kidId,
            kidName: kid.name,
            goalId: goal.id,
            name: `🎁 Buy Goal: ${goal.name}`,
            cost: goal.cost,
            status: "goal_claim"
          });
        }
      });
    }
  });

  if (pendingList.length === 0) {
    container.innerHTML = `
      <div class="no-pending-chores">
        <i class="fa-solid fa-face-smile"></i>
        <p>No chores or proposals waiting for approval right now!</p>
      </div>
    `;
    return;
  }

  pendingList.forEach(item => {
    const card = document.createElement("div");
    card.className = "approval-item";
    
    let tagText = "";
    let tagColor = "";
    let rewardText = "";
    let idVal = item.type === "goal_claim" ? item.goalId : item.choreId;

    if (item.type === "goal_claim") {
      tagText = "Purchase Request";
      tagColor = "#10b981";
      rewardText = `-${formatCurrency(item.cost)}`;
    } else {
      tagText = item.status === "proposed" ? "Suggested Quest" : "Completed Quest";
      tagColor = item.status === "proposed" ? "#a855f7" : "var(--color-pink)";
      rewardText = `+${formatCurrency(item.reward)}`;
    }
    
    card.innerHTML = `
      <div class="appr-details">
        <span class="appr-title">${item.name}</span>
        <span class="appr-meta">${tagText} by: <strong style="color: ${tagColor};">${item.kidName}</strong></span>
      </div>
      <div class="appr-reward ${item.type === 'goal_claim' ? 'minus' : ''}">
        ${rewardText}
      </div>
      <div class="appr-actions">
        <button class="btn-appr-ok" title="Approve" onclick="resolvePendingChore('${item.kidId}', ${idVal}, true, '${item.status}')">
          <i class="fa-solid fa-check"></i>
        </button>
        <button class="btn-appr-no" title="Reject" onclick="resolvePendingChore('${item.kidId}', ${idVal}, false, '${item.status}')">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    `;
    container.appendChild(card);
  });
}

function resolvePendingChore(kidId, itemId, isApproved, originalStatus) {
  const profile = db.profiles[kidId];

  if (originalStatus === "goal_claim") {
    const goalIndex = profile.goals.findIndex(g => g.id === itemId);
    if (goalIndex === -1) return;

    const goalName = profile.goals[goalIndex].name;
    const goalCost = profile.goals[goalIndex].cost;

    if (isApproved) {
      if (profile.balance < goalCost) {
        showToast("Insufficient Funds", `${profile.name} no longer has enough balance to buy this goal!`, "warning");
        return;
      }

      // Approve goal claim: deduct funds automatically!
      profile.balance = parseFloat((profile.balance - goalCost).toFixed(2));
      profile.goals[goalIndex].status = "completed";

      // Log withdrawal transaction in vault history
      profile.transactions.push({
        id: Date.now(),
        type: "withdraw",
        amount: -goalCost,
        desc: `Goal Purchased: ${goalName}`,
        date: new Date().toISOString()
      });

      saveDatabase();
      renderApp();
      showToast("Purchase Approved!", `Deducted ${formatCurrency(goalCost)} from ${profile.name}'s savings for "${goalName}"!`, "success");
    } else {
      // Reject goal claim: return to active savings board as "saving"
      profile.goals[goalIndex].status = "saving";
      saveDatabase();
      renderApp();
      showToast("Purchase Claim Denied", `Returned "${goalName}" to ${profile.name}'s board.`, "warning");
    }
    return;
  }

  // Chore resolution logic
  const choreIndex = profile.chores.findIndex(c => c.id === itemId);
  if (choreIndex === -1) return;

  const choreName = profile.chores[choreIndex].name;
  const rewardAmount = profile.chores[choreIndex].reward;

  if (originalStatus === "proposed") {
    if (isApproved) {
      // Streamlined Quest Proposal: single approval pays out instantly and completes the quest!
      profile.balance = parseFloat((profile.balance + rewardAmount).toFixed(2));
      profile.completedQuests += 1;
      profile.chores[choreIndex].status = "completed";

      // Ledger Transaction record
      profile.transactions.push({
        id: Date.now(),
        type: "deposit",
        amount: rewardAmount,
        desc: `Reward: Completed "${choreName}" (Proposed)`,
        date: new Date().toISOString()
      });

      saveDatabase();
      renderApp();
      showToast("Quest Payout Approved", `Quest "${choreName}" approved! Paid ${formatCurrency(rewardAmount)} to ${profile.name}!`, "success");
    } else {
      // Reject proposed quest: delete it entirely from their list!
      profile.chores = profile.chores.filter(c => c.id !== itemId);
      saveDatabase();
      renderApp();
      showToast("Suggestion Rejected", `Removed suggested quest "${choreName}".`, "warning");
    }
  } else {
    // Standard completed chores resolution
    if (isApproved) {
      // Approve completed: payout money!
      profile.balance += rewardAmount;
      profile.completedQuests += 1;
      profile.chores[choreIndex].status = "completed";

      // Ledger Transaction record
      profile.transactions.push({
        id: Date.now(),
        type: "deposit",
        amount: rewardAmount,
        desc: `Reward: Completed "${choreName}"`,
        date: new Date().toISOString()
      });

      saveDatabase();
      renderApp();
      showToast("Quest Payout Approved", `Paid ${formatCurrency(rewardAmount)} to ${profile.name}!`, "success");
    } else {
      // Reject completed: return back to active chores checklist
      profile.chores[choreIndex].status = "active";

      saveDatabase();
      renderApp();
      showToast("Quest Payout Rejected", `Quest "${choreName}" returned to active chores sheet.`, "warning");
    }
  }
}

// Assigns new chore in parent manager
function parentCreateNewChore() {
  const assignTarget = document.getElementById("newChoreKid").value;
  const nameInput = document.getElementById("newChoreName").value.trim();
  const rewardInput = parseFloat(document.getElementById("newChoreReward").value);

  if (!nameInput || isNaN(rewardInput) || rewardInput <= 0) {
    showToast("Invalid Chore", "Provide a chore name and reward coin value.", "warning");
    return;
  }

  const freshChore = (kidName) => ({
    id: Date.now() + (kidName === 'yitong' ? 99 : 0),
    name: nameInput,
    reward: rewardInput,
    status: "active"
  });

  if (assignTarget === "both") {
    db.profiles.linheng.chores.push(freshChore('linheng'));
    db.profiles.yitong.chores.push(freshChore('yitong'));
  } else {
    db.profiles[assignTarget].chores.push(freshChore(assignTarget));
  }

  saveDatabase();
  renderApp();

  document.getElementById("newChoreName").value = "";
  document.getElementById("newChoreReward").value = "";

  showToast("Chore Quest Assigned", `Launched quest "${nameInput}" for ${assignTarget === 'both' ? 'both kids' : db.profiles[assignTarget].name}!`, "success");
}

/* ==========================================
   PARENT PORTAL INTEREST SETTINGS SLIDER
   ========================================== */
function parentInterestSliderChange(newVal) {
  document.getElementById("interestRateVal").innerText = `${newVal}%`;
  
  const selectedKid = document.getElementById("parentKidSelector").value;
  db.profiles[selectedKid].interestRate = parseInt(newVal);
  
  saveDatabase();
  
  // Redraw both Graphs and info in real-time
  renderGrowthChart();
  renderKidGrowthChart();
  
  // Update interest display chip inside Kid Mode
  document.getElementById("currentRateDisplay").innerText = `${newVal}%`;
}

/* ==========================================
   EDUCATIONAL INTEREST SIMULATOR GRAPH (PARENT PORTAL)
   ========================================== */
function renderGrowthChart() {
  const selectedKid = document.getElementById("parentKidSelector").value;
  const profile = db.profiles[selectedKid];
  const rate = profile.interestRate / 100;
  const startBal = profile.balance;

  const labels = [];
  const withInterestData = [];
  const piggyBankData = [];

  // Generate 10 years of forecast interest compounding
  for (let year = 0; year <= 10; year++) {
    labels.push(`Yr ${year}`);
    
    // Standard flat Piggy bank
    piggyBankData.push(parseFloat(startBal.toFixed(2)));
    
    // Annual compounding interest
    const interestGrowth = startBal * Math.pow(1 + rate, year);
    withInterestData.push(parseFloat(interestGrowth.toFixed(2)));
  }

  const ctx = document.getElementById("growthChart").getContext("2d");
  
  if (forecastChartInstance) {
    forecastChartInstance.destroy();
  }

  forecastChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Earning Interest',
          data: withInterestData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointRadius: 4
        },
        {
          label: 'Zero Interest Piggy',
          data: piggyBankData,
          borderColor: '#ec4899',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 2,
          pointBackgroundColor: '#ec4899'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: {
              family: 'Outfit',
              weight: 'bold',
              size: 10
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit' }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit' },
            callback: function(value) {
              return '$' + value;
            }
          }
        }
      }
    }
  });
}

/* ==========================================
   KIDS PORTAL INTEREST FORECAST CHART
   ========================================== */
function renderKidGrowthChart() {
  const activeKid = db.activeKid;
  const profile = db.profiles[activeKid];
  const rate = profile.interestRate / 100;
  const startBal = profile.balance;

  // Expected Daily Interest calculation: (Balance * Rate) / 365
  const dailyGrowth = (profile.balance * rate) / 365;
  const dailyGrowthEl = document.getElementById("dailyGrowthDisplay");
  if (dailyGrowthEl) {
    dailyGrowthEl.innerText = `+${formatCurrency(dailyGrowth)} / day`;
  }

  const labels = [];
  const withInterestData = [];
  const piggyBankData = [];

  // Generate 10 years of forecast interest compounding
  for (let year = 0; year <= 10; year++) {
    labels.push(`Yr ${year}`);
    
    // Standard flat Piggy bank
    piggyBankData.push(parseFloat(startBal.toFixed(2)));
    
    // Annual compounding interest
    const interestGrowth = startBal * Math.pow(1 + rate, year);
    withInterestData.push(parseFloat(interestGrowth.toFixed(2)));
  }

  const ctx = document.getElementById("growthChartKid");
  if (!ctx) return; // Guard clause in case canvas hasn't mounted

  const ctx2d = ctx.getContext("2d");
  
  if (forecastChartKidInstance) {
    forecastChartKidInstance.destroy();
  }

  // Kid mode color scheme selection (Linheng: Orange/Gold, Yitong: Teal/Cyan)
  const lineColor = activeKid === 'linheng' ? '#ff6b00' : '#00bcd4';
  const glowColor = activeKid === 'linheng' ? 'rgba(255, 107, 0, 0.1)' : 'rgba(0, 188, 212, 0.1)';

  forecastChartKidInstance = new Chart(ctx2d, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Earning Interest',
          data: withInterestData,
          borderColor: lineColor,
          backgroundColor: glowColor,
          borderWidth: 3.5,
          tension: 0.35,
          fill: true,
          pointBackgroundColor: lineColor,
          pointBorderColor: '#fff',
          pointRadius: 5
        },
        {
          label: 'Zero Interest Piggy',
          data: piggyBankData,
          borderColor: '#ec4899',
          borderDash: [5, 5],
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 2,
          pointBackgroundColor: '#ec4899'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94a3b8',
            font: {
              family: 'Outfit',
              weight: 'bold',
              size: 11
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit', weight: 'bold' }
          }
        },
        y: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: '#94a3b8',
            font: { family: 'Outfit', weight: 'bold' },
            callback: function(value) {
              return '$' + value;
            }
          }
        }
      }
    }
  });
}

/* ==========================================
   INTEREST ENGINE - FRAC TICK vs TIME-WARP
   ========================================== */

// 1. Core Background Interest Tick (accrues true fractions silently)
function startRealTimeInterest() {
  // Replaced by 6:00 PM Pacific Time Daily Interest compounding
}

// Check date and deposit daily compounding interest retrospectively (6:00 PM local device time)
function checkAndDepositDailyInterest() {
  if (db.timeWarpActive) return; // Prevent double compounding during simulated Time-Warp Mode
  
  let dbChanged = false;
  const now = new Date();
  
  ['linheng', 'yitong'].forEach(kidId => {
    const profile = db.profiles[kidId];
    if (profile.balance <= 0 || profile.interestRate <= 0) return;
    
    // Seed lastInterestDate if missing
    if (!profile.lastInterestDate) {
      let initialLastInterest = new Date(now);
      initialLastInterest.setHours(18, 0, 0, 0); // 6:00 PM
      if (initialLastInterest.getTime() > now.getTime()) {
        initialLastInterest.setTime(initialLastInterest.getTime() - 24 * 60 * 60 * 1000);
      }
      profile.lastInterestDate = initialLastInterest.toISOString();
      dbChanged = true;
      return;
    }
    
    let tempDate = new Date(profile.lastInterestDate);
    // Reset exact hours to 18:00 (6 PM) to ensure rollover precision
    tempDate.setHours(18, 0, 0, 0);
    
    let rolloverCount = 0;
    let compoundingBalance = profile.balance;
    let accumulatedInterest = 0;
    
    while (true) {
      // Advance by 1 day
      let next6PM = new Date(tempDate.getTime() + 24 * 60 * 60 * 1000);
      next6PM.setHours(18, 0, 0, 0);
      
      if (next6PM.getTime() <= now.getTime()) {
        const dailyRate = (profile.interestRate / 100) / 365;
        const earned = compoundingBalance * dailyRate;
        compoundingBalance += earned;
        accumulatedInterest += earned;
        rolloverCount++;
        tempDate = next6PM;
      } else {
        break;
      }
    }
    
    if (rolloverCount > 0) {
      profile.balance = parseFloat(compoundingBalance.toFixed(2));
      profile.totalInterest = parseFloat((profile.totalInterest + accumulatedInterest).toFixed(2));
      profile.lastInterestDate = tempDate.toISOString();
      
      // Log consolidated deposit transaction in ledger history
      profile.transactions.push({
        id: Date.now() + (kidId === 'yitong' ? 99 : 0),
        type: "deposit",
        amount: parseFloat(accumulatedInterest.toFixed(2)),
        desc: `Daily Interest (${rolloverCount} day${rolloverCount > 1 ? 's' : ''} at ${profile.interestRate}% APR)`,
        date: now.toISOString()
      });
      
      dbChanged = true;
      
      // Visual notification toast in kid mode for the currently active kid
      if (db.activeKid === kidId) {
        setTimeout(() => {
          showToast("Interest Credited!", `Earned +${formatCurrency(accumulatedInterest)} daily interest!`, "success");
        }, 1500);
      }
    }
  });
  
  if (dbChanged) {
    saveDatabase();
    renderApp();
  }
}

// Check date and deposit daily allowance retrospectively
function checkAndDepositAllowance() {
  let dbChanged = false;
  const now = new Date();
  
  ['linheng', 'yitong'].forEach(kidId => {
    const profile = db.profiles[kidId];
    
    // Seed lastAllowanceDate if missing or invalid
    if (!profile.lastAllowanceDate) {
      profile.lastAllowanceDate = now.toISOString();
      dbChanged = true;
      return;
    }
    
    const lastDate = new Date(profile.lastAllowanceDate);
    const diffMs = now.getTime() - lastDate.getTime();
    
    // Standard calendar day difference (24 hours)
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0) {
      const allowanceAmount = diffDays * 1.00;
      profile.balance = parseFloat((profile.balance + allowanceAmount).toFixed(2));
      
      // Log transaction
      profile.transactions.push({
        id: Date.now() + (kidId === 'yitong' ? 99 : 0),
        type: "deposit",
        amount: allowanceAmount,
        desc: `Daily Allowance (${diffDays} day${diffDays > 1 ? 's' : ''})`,
        date: now.toISOString()
      });
      
      // Shift date precisely forward by diffDays to maintain precision
      const updatedDate = new Date(lastDate.getTime() + diffDays * 24 * 60 * 60 * 1000);
      profile.lastAllowanceDate = updatedDate.toISOString();
      
      dbChanged = true;
      
      // Visual notification toast in kid mode for the currently active kid
      if (db.activeKid === kidId) {
        // Run after DOM has loaded to ensure toast box element exists
        setTimeout(() => {
          showToast("Allowance Credited!", `Got +${formatCurrency(allowanceAmount)} allowance for ${diffDays} day${diffDays > 1 ? 's' : ''}!`, "success");
        }, 1000);
      }
    }
  });
  
  if (dbChanged) {
    saveDatabase();
    renderApp();
  }
}

// 2. High-speed Educational Time-Warp Mode
function toggleTimeWarp(isChecked) {
  db.timeWarpActive = isChecked;
  saveDatabase();

  const indicator = document.getElementById("timeWarpActiveIndicator");

  if (isChecked) {
    indicator.classList.remove("hidden");
    startTimeWarp();
    showToast("Time Warp Active!", "Educational interest engine started. 1 year ticks every 10 seconds!", "success");
  } else {
    indicator.classList.add("hidden");
    if (timeWarpInterval) clearInterval(timeWarpInterval);
    showToast("Time Warp Stopped", "Warp speeds powered down. Back to standard real-time ticks.", "info");
  }
}

function startTimeWarp() {
  if (timeWarpInterval) clearInterval(timeWarpInterval);

  // Tick 1 simulated compounding year every 10 seconds!
  timeWarpInterval = setInterval(() => {
    let compoundOccurred = false;

    ['linheng', 'yitong'].forEach(kidId => {
      const profile = db.profiles[kidId];
      if (profile.balance <= 0 || profile.interestRate <= 0) return;

      const rate = profile.interestRate / 100;
      const earned = parseFloat((profile.balance * rate).toFixed(2));
      const annualAllowance = 365.00; // $1.00/day * 365 days

      profile.balance = parseFloat((profile.balance + earned + annualAllowance).toFixed(2));
      profile.totalInterest = parseFloat((profile.totalInterest + earned).toFixed(2));

      const dateStr = new Date().toISOString();

      // Append transaction ledger record for this Year tick (Interest)
      profile.transactions.push({
        id: Date.now() + (kidId === 'yitong' ? 99 : 0),
        type: "deposit",
        amount: earned,
        desc: `Time-Warp Compound Interest (1 Yr Tick)`,
        date: dateStr
      });

      // Append transaction ledger record for this Year tick (Allowance)
      profile.transactions.push({
        id: Date.now() + (kidId === 'yitong' ? 999 : 9),
        type: "deposit",
        amount: annualAllowance,
        desc: `Time-Warp Annual Allowance`,
        date: dateStr
      });

      compoundOccurred = true;
    });

    if (compoundOccurred) {
      saveDatabase();
      renderApp();
      
      // Sound cue or visual bounce effect to welcome kid
      triggerPiggyWiggle();
      showToast("Compound Ticked!", "Simulated year elapsed! Check your new high balances!", "success");
    }
  }, 10000);
}

/* ==========================================
   TOAST NOTIFICATION ENGINE
   ========================================== */
function showToast(title, msg, type = 'info') {
  const toast = document.getElementById("toastBox");
  const iconBox = document.getElementById("toastIcon");
  const titleBox = document.getElementById("toastTitle");
  const msgBox = document.getElementById("toastMsg");

  // Set message
  titleBox.innerText = title;
  msgBox.innerText = msg;

  // Set colors and icons
  toast.className = "toast-notification"; // Reset
  iconBox.className = "toast-icon";
  
  if (type === 'success') {
    iconBox.classList.add("success");
    iconBox.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    toast.style.borderColor = "var(--color-green)";
  } else if (type === 'warning') {
    iconBox.classList.add("warning");
    iconBox.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
    toast.style.borderColor = "var(--color-yellow)";
  } else {
    iconBox.classList.add("info");
    iconBox.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
    toast.style.borderColor = "var(--color-blue)";
  }

  // Show
  toast.classList.remove("hidden");

  // Fade out timer
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}
