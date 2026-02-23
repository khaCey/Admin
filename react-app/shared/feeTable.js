/**
 * Fee table - ported from Code.js
 */
export const feeTable = {
  OLD: {
    Single: {
      '2x': 4620,
      '4x': 4400,
      '8x': 3960,
    },
    Group: {
      2: { '2x': 2860, '4x': 2750, '8x': 2530 },
      3: { '2x': 2273, '4x': 2200, '8x': 2053 },
      4: { '2x': 1980, '4x': 1925, '8x': 1815 },
    },
    Pronunciation: 7700,
  },
  Neo: {
    Single: {
      '2x': 7150,
      '4x': 5720,
      '8x': 4950,
    },
    Group: {
      2: { '2x': 4675, '4x': 3960, '8x': 3575 },
      3: { '2x': 3850, '4x': 3373, '8x': 3117 },
      4: { '2x': 3438, '4x': 3080, '8x': 2888 },
    },
  },
  "Owner's Lesson": 9350,
};

export function calculatePrice(lessonsCount, paymentType = 'Neo', groupType = 'Single', groupSize = 2, frequency = '4x') {
  const payment = paymentType === 'OLD' ? feeTable.OLD : feeTable.Neo;
  if (lessonsCount === 1 && paymentType === 'Neo') {
    return feeTable["Owner's Lesson"];
  }
  if (groupType === 'Single') {
    const freq = lessonsCount <= 2 ? '2x' : lessonsCount <= 4 ? '4x' : '8x';
    return payment.Single[freq] || 0;
  }
  const size = Math.min(4, Math.max(2, groupSize));
  const freq = lessonsCount <= 2 ? '2x' : lessonsCount <= 4 ? '4x' : '8x';
  return payment.Group[size]?.[freq] || 0;
}
