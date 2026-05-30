/**
 * 将数字转换为中文数字
 */
export function toChineseNumber(num) {
  const units = ['', '十', '百', '千'];
  const nums = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  
  if (num <= 10) {
    return nums[num] || String(num);
  }
  if (num < 20) {
    return '十' + (num % 10 === 0 ? '' : nums[num % 10]);
  }
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return nums[tens] + '十' + (ones === 0 ? '' : nums[ones]);
  }
  return String(num); // 超过99直接用阿拉伯数字
}
