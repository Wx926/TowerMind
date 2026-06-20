const colors = ["#166534", "#22C55E", "#4ADE80", "#86EFAC", "#EAB308"];

function makeChart(id, opt) {
  const el = document.getElementById(id);
  if (!el) return;

  const c = echarts.init(el);
  c.setOption(opt);
  window.addEventListener("resize", () => c.resize());
}

makeChart("energyChart", {
  color: colors,
  tooltip: { trigger: "axis" },
  grid: { left: 45, right: 20, top: 30, bottom: 35 },
  xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
  yAxis: { type: "value" },
  series: [
    {
      name: "Energy kWh",
      type: "line",
      smooth: true,
      symbolSize: 8,
      lineStyle: { width: 4 },
      areaStyle: { opacity: 0.18 },
      data: [1200, 1350, 1280, 1420, 1500, 1100, 980]
    }
  ]
});

makeChart("roomChart", {
  color: ["#22C55E", "#86EFAC", "#EAB308"],
  tooltip: { trigger: "item" },
  legend: { bottom: 0 },
  series: [
    {
      type: "pie",
      radius: ["48%", "72%"],
      center: ["50%", "43%"],
      data: [
        { value: 52, name: "Used" },
        { value: 28, name: "Available" },
        { value: 20, name: "Idle" }
      ]
    }
  ]
});

const days = Array.from({ length: 30 }, (_, i) => "D" + (i + 1));
const base = [35, 36, 36, 37, 38, 37, 39, 40, 40, 41, 42, 41, 43, 44, 45, 44, 46, 47, 46, 48, 49, 50, 50, 51, 52, 51, 53, 54, 55, 56];

makeChart("forecastChart", {
  color: ["#166534", "#22C55E", "#22C55E"],
  tooltip: { trigger: "axis" },
  legend: { top: 0 },
  grid: { left: 45, right: 20, top: 45, bottom: 35 },
  xAxis: { type: "category", data: days },
  yAxis: { type: "value", name: "RM x1000" },
  series: [
    {
      name: "Forecast",
      type: "line",
      smooth: true,
      data: base,
      lineStyle: { width: 4 },
      areaStyle: { opacity: 0.12 }
    },
    {
      name: "Upper Band",
      type: "line",
      smooth: true,
      data: base.map(v => v + 3),
      lineStyle: { type: "dashed" },
      symbol: "none"
    },
    {
      name: "Lower Band",
      type: "line",
      smooth: true,
      data: base.map(v => v - 3),
      lineStyle: { type: "dashed" },
      symbol: "none"
    }
  ]
});

(function navScrollSpy() {
  const navLinks = document.querySelectorAll(".nav-links a[href^='#']");
  if (!navLinks.length) return;

  const sections = Array.from(navLinks)
    .map(a => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  function setActive() {
    const scrollPos = window.scrollY + 110; // clear the fixed navbar height
    let current = sections[0];
    sections.forEach(sec => {
      if (sec.offsetTop <= scrollPos) current = sec;
    });
    navLinks.forEach(a => {
      a.classList.toggle("active", a.getAttribute("href") === "#" + current.id);
    });
  }

  window.addEventListener("scroll", setActive, { passive: true });
  setActive();
})();

function runSimulation() {
  document.querySelectorAll(".scenario-card").forEach((card, i) => {
    card.style.transform = "translateY(-8px)";
    card.style.transition = "0.25s";
    setTimeout(() => card.style.transform = "translateY(0)", 450 + i * 120);
  });

  alert("AI simulation completed. Scenario C is recommended for highest savings and carbon reduction.");
}
