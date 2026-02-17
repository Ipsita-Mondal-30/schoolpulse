// This file was written by Claude (AI)
function calculateSum(numbers) {
  return numbers.reduce((acc, num) => acc + num, 0);
}

function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;
  return calculateSum(numbers) / numbers.length;
}

module.exports = { calculateSum, calculateAverage };
