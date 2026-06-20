// Volt Buddy: animated AI energy mascot card shown in the hero panel.
(function initVoltBuddy() {
  const card = document.getElementById("vbCard");
  if (!card) return;

  const historicalData = {
    current: { usage: 6848, avg: 12450, label: "current month" },
    lastMonth: { usage: 11200, avg: 12450, label: "previous month" },
    threeMonths: { usage: 9800, avg: 12450, label: "3-month average" },
    sixMonths: { usage: 10300, avg: 12450, label: "6-month average" },
    oneYear: { usage: 8900, avg: 12450, label: "1-year average" }
  };

  let currentPeriod = "current";
  let currentPercentage = 65;

  const batteryFill = card.querySelector(".vb-fill");
  const batteryValue = card.querySelector(".vb-value");
  const batteryMan = card.querySelector(".vb-man");
  const face = card.querySelector(".vb-head");
  const statusPill = card.querySelector(".vb-status-pill");

  function updateBuddy(value) {
    batteryValue.innerText = Math.round(value) + "%";
    batteryFill.style.height = Math.min(value, 100) + "%";

    let status, color, animation, faceIcon, statusClass;

    if (value < 70) {
      status = "Optimal"; statusClass = "green";
      color = "linear-gradient(180deg, #86EFAC, #22C55E)"; animation = "floating"; faceIcon = "😎";
    } else if (value < 85) {
      status = "Warning"; statusClass = "yellow";
      color = "linear-gradient(180deg, #FDE68A, #EAB308)"; animation = "worry"; faceIcon = "😐";
    } else if (value < 100) {
      status = "High Usage"; statusClass = "orange";
      color = "linear-gradient(180deg, #FDBA74, #F97316)"; animation = "shaking"; faceIcon = "😰";
    } else if (value < 120) {
      status = "Critical"; statusClass = "red";
      color = "linear-gradient(180deg, #FCA5A5, #EF4444)"; animation = "danger"; faceIcon = "😫";
    } else {
      status = "Overload"; statusClass = "red";
      color = "linear-gradient(180deg, #FCA5A5, #DC2626)"; animation = "danger"; faceIcon = "😡";
    }

    batteryMan.className = "vb-man " + animation;
    face.innerText = faceIcon;
    statusPill.innerText = status;
    statusPill.className = "vb-status-pill " + statusClass;
    batteryFill.style.background = color;
    currentPercentage = value;
  }

  function switchPeriod(period) {
    currentPeriod = period;
    card.querySelectorAll(".vb-month-selector button").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.period === period);
    });
    const data = historicalData[period];
    updateBuddy(Math.round((data.usage / data.avg) * 100));
  }

  card.querySelectorAll(".vb-month-selector button").forEach(btn => {
    btn.addEventListener("click", () => switchPeriod(btn.dataset.period));
  });

  switchPeriod("current");

  setInterval(() => {
    if (currentPeriod === "current") {
      const change = (Math.random() - 0.45) * 5;
      const newVal = Math.min(150, Math.max(20, currentPercentage + change));
      updateBuddy(newVal);
    }
  }, 6000);
})();
