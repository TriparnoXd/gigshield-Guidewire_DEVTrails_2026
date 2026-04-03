/**
 * Calculate payout amount from disruption hours
 * @param {number} disruptionHours
 * @param {number} hourlyRate
 * @param {number} maxWeeklyPayout
 * @returns {number} payout amount (capped at maxWeeklyPayout)
 */
function calculatePayout(disruptionHours, hourlyRate, maxWeeklyPayout) {
  const rawPayout = disruptionHours * hourlyRate;
  return Math.min(rawPayout, maxWeeklyPayout);
}

/**
 * Calculate hourly rate from worker stats
 * @param {number} avgWeeklyEarn
 * @param {number} avgActiveHours
 * @returns {number} hourly rate
 */
function calculateHourlyRate(avgWeeklyEarn, avgActiveHours) {
  // Weekly working hours = avg_active_hrs * 7 days
  const weeklyHours = avgActiveHours * 7;
  return avgWeeklyEarn / weeklyHours;
}

module.exports = { calculatePayout, calculateHourlyRate };
