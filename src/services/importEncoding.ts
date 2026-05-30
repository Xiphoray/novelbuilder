/**
 * 文件编码检测和解码功能
 */

import jschardet from 'jschardet';

/** 常见中文编码列表 */
const COMMON_ENCODINGS = ['utf-8', 'gbk', 'gb2312', 'big5', 'gb18030', 'euc-cn'];

/**
 * 检测并解码文件内容
 */
export function decodeFileBuffer(buffer: ArrayBuffer): { text: string; encoding: string } {
  const uint8 = new Uint8Array(buffer);

  // 优先尝试 UTF-8，因为大多数现代文本文件都是 UTF-8 编码
  const utf8Text = tryDecode(uint8, 'utf-8');
  if (utf8Text && !hasGarbledText(utf8Text)) {
    console.log('[ImportService] UTF-8 decode successful');
    return { text: utf8Text, encoding: 'utf-8' };
  }

  // 尝试 jschardet 检测编码
  const detected = jschardet.detect(uint8);
  let encoding = (detected.encoding || 'utf-8').toLowerCase();

  // 标准化编码名称
  encoding = encoding.replace(/[^a-z0-9-]/g, '');
  if (encoding === 'ascii') encoding = 'utf-8';

  // 尝试用检测到的编码解码
  let text = tryDecode(uint8, encoding);

  // 如果解码结果包含大量乱码（替换字符），尝试常见编码
  if (!text || hasGarbledText(text)) {
    console.log(`[ImportService] Encoding ${encoding} failed or has garbled text, trying alternatives...`);
    for (const enc of COMMON_ENCODINGS) {
      if (enc === encoding) continue;
      const candidate = tryDecode(uint8, enc);
      if (candidate && !hasGarbledText(candidate)) {
        text = candidate;
        encoding = enc;
        console.log(`[ImportService] Found working encoding: ${enc}`);
        break;
      }
    }
  }

  // 若仍未找到可读编码，则返回空字符串，让调用方决定是否弹出选择框
  return { text: text || '', encoding };
}

/**
 * 尝试用指定编码解码
 */
export function tryDecode(uint8: Uint8Array, encoding: string): string {
  try {
    const decoder = new TextDecoder(encoding);
    return decoder.decode(uint8);
  } catch {
    return '';
  }
}

/**
 * 检测文本是否包含大量乱码（Unicode 替换字符 U+FFFD）
 */
function hasGarbledText(text: string): boolean {
  const sample = text.substring(0, 2000);
  const replacementCount = (sample.match(/\ufffd/g) || []).length;
  return replacementCount > sample.length * 0.05;
}
