var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __commonJS = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};
var __esm = (fn, res) => () => (fn && (res = fn(fn = 0)), res);

// node:buffer
var exports_buffer = {};
__export(exports_buffer, {
  transcode: () => transcode,
  resolveObjectURL: () => resolveObjectURL,
  kStringMaxLength: () => kStringMaxLength,
  kMaxLength: () => kMaxLength,
  isUtf8: () => isUtf8,
  isAscii: () => isAscii,
  default: () => buffer_default,
  constants: () => constants,
  btoa: () => btoa,
  atob: () => atob,
  INSPECT_MAX_BYTES: () => INSPECT_MAX_BYTES,
  File: () => File,
  Buffer: () => Buffer2,
  Blob: () => Blob2
});
function getLens(b64) {
  var len2 = b64.length;
  if (len2 % 4 > 0)
    throw Error("Invalid string. Length must be a multiple of 4");
  var validLen = b64.indexOf("=");
  if (validLen === -1)
    validLen = len2;
  var placeHoldersLen = validLen === len2 ? 0 : 4 - validLen % 4;
  return [validLen, placeHoldersLen];
}
function _byteLength(validLen, placeHoldersLen) {
  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
}
function toByteArray(b64) {
  var tmp, lens = getLens(b64), validLen = lens[0], placeHoldersLen = lens[1], arr = new Uint8Array(_byteLength(validLen, placeHoldersLen)), curByte = 0, len2 = placeHoldersLen > 0 ? validLen - 4 : validLen, i2;
  for (i2 = 0;i2 < len2; i2 += 4)
    tmp = revLookup[b64.charCodeAt(i2)] << 18 | revLookup[b64.charCodeAt(i2 + 1)] << 12 | revLookup[b64.charCodeAt(i2 + 2)] << 6 | revLookup[b64.charCodeAt(i2 + 3)], arr[curByte++] = tmp >> 16 & 255, arr[curByte++] = tmp >> 8 & 255, arr[curByte++] = tmp & 255;
  if (placeHoldersLen === 2)
    tmp = revLookup[b64.charCodeAt(i2)] << 2 | revLookup[b64.charCodeAt(i2 + 1)] >> 4, arr[curByte++] = tmp & 255;
  if (placeHoldersLen === 1)
    tmp = revLookup[b64.charCodeAt(i2)] << 10 | revLookup[b64.charCodeAt(i2 + 1)] << 4 | revLookup[b64.charCodeAt(i2 + 2)] >> 2, arr[curByte++] = tmp >> 8 & 255, arr[curByte++] = tmp & 255;
  return arr;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end) {
  var tmp, output = [];
  for (var i2 = start;i2 < end; i2 += 3)
    tmp = (uint8[i2] << 16 & 16711680) + (uint8[i2 + 1] << 8 & 65280) + (uint8[i2 + 2] & 255), output.push(tripletToBase64(tmp));
  return output.join("");
}
function fromByteArray(uint8) {
  var tmp, len2 = uint8.length, extraBytes = len2 % 3, parts = [], maxChunkLength = 16383;
  for (var i2 = 0, len22 = len2 - extraBytes;i2 < len22; i2 += maxChunkLength)
    parts.push(encodeChunk(uint8, i2, i2 + maxChunkLength > len22 ? len22 : i2 + maxChunkLength));
  if (extraBytes === 1)
    tmp = uint8[len2 - 1], parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==");
  else if (extraBytes === 2)
    tmp = (uint8[len2 - 2] << 8) + uint8[len2 - 1], parts.push(lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "=");
  return parts.join("");
}
function read(buffer, offset, isLE, mLen, nBytes) {
  var e, m, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, nBits = -7, i2 = isLE ? nBytes - 1 : 0, d = isLE ? -1 : 1, s = buffer[offset + i2];
  i2 += d, e = s & (1 << -nBits) - 1, s >>= -nBits, nBits += eLen;
  for (;nBits > 0; e = e * 256 + buffer[offset + i2], i2 += d, nBits -= 8)
    ;
  m = e & (1 << -nBits) - 1, e >>= -nBits, nBits += mLen;
  for (;nBits > 0; m = m * 256 + buffer[offset + i2], i2 += d, nBits -= 8)
    ;
  if (e === 0)
    e = 1 - eBias;
  else if (e === eMax)
    return m ? NaN : (s ? -1 : 1) * (1 / 0);
  else
    m = m + Math.pow(2, mLen), e = e - eBias;
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
}
function write(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c, eLen = nBytes * 8 - mLen - 1, eMax = (1 << eLen) - 1, eBias = eMax >> 1, rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0, i2 = isLE ? 0 : nBytes - 1, d = isLE ? 1 : -1, s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  if (value = Math.abs(value), isNaN(value) || value === 1 / 0)
    m = isNaN(value) ? 1 : 0, e = eMax;
  else {
    if (e = Math.floor(Math.log(value) / Math.LN2), value * (c = Math.pow(2, -e)) < 1)
      e--, c *= 2;
    if (e + eBias >= 1)
      value += rt / c;
    else
      value += rt * Math.pow(2, 1 - eBias);
    if (value * c >= 2)
      e++, c /= 2;
    if (e + eBias >= eMax)
      m = 0, e = eMax;
    else if (e + eBias >= 1)
      m = (value * c - 1) * Math.pow(2, mLen), e = e + eBias;
    else
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen), e = 0;
  }
  for (;mLen >= 8; buffer[offset + i2] = m & 255, i2 += d, m /= 256, mLen -= 8)
    ;
  e = e << mLen | m, eLen += mLen;
  for (;eLen > 0; buffer[offset + i2] = e & 255, i2 += d, e /= 256, eLen -= 8)
    ;
  buffer[offset + i2 - d] |= s * 128;
}
function createBuffer(length) {
  if (length > kMaxLength)
    throw RangeError('The value "' + length + '" is invalid for option "size"');
  let buf = new Uint8Array(length);
  return Object.setPrototypeOf(buf, Buffer2.prototype), buf;
}
function E(sym, getMessage, Base) {
  return class extends Base {
    constructor() {
      super();
      Object.defineProperty(this, "message", { value: getMessage.apply(this, arguments), writable: true, configurable: true }), this.name = `${this.name} [${sym}]`, this.stack, delete this.name;
    }
    get code() {
      return sym;
    }
    set code(value) {
      Object.defineProperty(this, "code", { configurable: true, enumerable: true, value, writable: true });
    }
    toString() {
      return `${this.name} [${sym}]: ${this.message}`;
    }
  };
}
function Buffer2(arg, encodingOrOffset, length) {
  if (typeof arg === "number") {
    if (typeof encodingOrOffset === "string")
      throw TypeError('The "string" argument must be of type string. Received type number');
    return allocUnsafe(arg);
  }
  return from(arg, encodingOrOffset, length);
}
function from(value, encodingOrOffset, length) {
  if (typeof value === "string")
    return fromString(value, encodingOrOffset);
  if (ArrayBuffer.isView(value))
    return fromArrayView(value);
  if (value == null)
    throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value);
  if (isInstance(value, ArrayBuffer) || value && isInstance(value.buffer, ArrayBuffer))
    return fromArrayBuffer(value, encodingOrOffset, length);
  if (typeof SharedArrayBuffer < "u" && (isInstance(value, SharedArrayBuffer) || value && isInstance(value.buffer, SharedArrayBuffer)))
    return fromArrayBuffer(value, encodingOrOffset, length);
  if (typeof value === "number")
    throw TypeError('The "value" argument must not be of type number. Received type number');
  let valueOf = value.valueOf && value.valueOf();
  if (valueOf != null && valueOf !== value)
    return Buffer2.from(valueOf, encodingOrOffset, length);
  let b = fromObject(value);
  if (b)
    return b;
  if (typeof Symbol < "u" && Symbol.toPrimitive != null && typeof value[Symbol.toPrimitive] === "function")
    return Buffer2.from(value[Symbol.toPrimitive]("string"), encodingOrOffset, length);
  throw TypeError("The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type " + typeof value);
}
function assertSize(size) {
  if (typeof size !== "number")
    throw TypeError('"size" argument must be of type number');
  else if (size < 0)
    throw RangeError('The value "' + size + '" is invalid for option "size"');
}
function alloc(size, fill, encoding) {
  if (assertSize(size), size <= 0)
    return createBuffer(size);
  if (fill !== undefined)
    return typeof encoding === "string" ? createBuffer(size).fill(fill, encoding) : createBuffer(size).fill(fill);
  return createBuffer(size);
}
function allocUnsafe(size) {
  return assertSize(size), createBuffer(size < 0 ? 0 : checked(size) | 0);
}
function fromString(string, encoding) {
  if (typeof encoding !== "string" || encoding === "")
    encoding = "utf8";
  if (!Buffer2.isEncoding(encoding))
    throw TypeError("Unknown encoding: " + encoding);
  let length = byteLength(string, encoding) | 0, buf = createBuffer(length), actual = buf.write(string, encoding);
  if (actual !== length)
    buf = buf.slice(0, actual);
  return buf;
}
function fromArrayLike(array) {
  let length = array.length < 0 ? 0 : checked(array.length) | 0, buf = createBuffer(length);
  for (let i2 = 0;i2 < length; i2 += 1)
    buf[i2] = array[i2] & 255;
  return buf;
}
function fromArrayView(arrayView) {
  if (isInstance(arrayView, Uint8Array)) {
    let copy = new Uint8Array(arrayView);
    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength);
  }
  return fromArrayLike(arrayView);
}
function fromArrayBuffer(array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset)
    throw RangeError('"offset" is outside of buffer bounds');
  if (array.byteLength < byteOffset + (length || 0))
    throw RangeError('"length" is outside of buffer bounds');
  let buf;
  if (byteOffset === undefined && length === undefined)
    buf = new Uint8Array(array);
  else if (length === undefined)
    buf = new Uint8Array(array, byteOffset);
  else
    buf = new Uint8Array(array, byteOffset, length);
  return Object.setPrototypeOf(buf, Buffer2.prototype), buf;
}
function fromObject(obj) {
  if (Buffer2.isBuffer(obj)) {
    let len2 = checked(obj.length) | 0, buf = createBuffer(len2);
    if (buf.length === 0)
      return buf;
    return obj.copy(buf, 0, 0, len2), buf;
  }
  if (obj.length !== undefined) {
    if (typeof obj.length !== "number" || Number.isNaN(obj.length))
      return createBuffer(0);
    return fromArrayLike(obj);
  }
  if (obj.type === "Buffer" && Array.isArray(obj.data))
    return fromArrayLike(obj.data);
}
function checked(length) {
  if (length >= kMaxLength)
    throw RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + kMaxLength.toString(16) + " bytes");
  return length | 0;
}
function byteLength(string, encoding) {
  if (Buffer2.isBuffer(string))
    return string.length;
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer))
    return string.byteLength;
  if (typeof string !== "string")
    throw TypeError('The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' + typeof string);
  let len2 = string.length, mustMatch = arguments.length > 2 && arguments[2] === true;
  if (!mustMatch && len2 === 0)
    return 0;
  let loweredCase = false;
  for (;; )
    switch (encoding) {
      case "ascii":
      case "latin1":
      case "binary":
        return len2;
      case "utf8":
      case "utf-8":
        return utf8ToBytes(string).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return len2 * 2;
      case "hex":
        return len2 >>> 1;
      case "base64":
        return base64ToBytes(string).length;
      default:
        if (loweredCase)
          return mustMatch ? -1 : utf8ToBytes(string).length;
        encoding = ("" + encoding).toLowerCase(), loweredCase = true;
    }
}
function slowToString(encoding, start, end) {
  let loweredCase = false;
  if (start === undefined || start < 0)
    start = 0;
  if (start > this.length)
    return "";
  if (end === undefined || end > this.length)
    end = this.length;
  if (end <= 0)
    return "";
  if (end >>>= 0, start >>>= 0, end <= start)
    return "";
  if (!encoding)
    encoding = "utf8";
  while (true)
    switch (encoding) {
      case "hex":
        return hexSlice(this, start, end);
      case "utf8":
      case "utf-8":
        return utf8Slice(this, start, end);
      case "ascii":
        return asciiSlice(this, start, end);
      case "latin1":
      case "binary":
        return latin1Slice(this, start, end);
      case "base64":
        return base64Slice(this, start, end);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return utf16leSlice(this, start, end);
      default:
        if (loweredCase)
          throw TypeError("Unknown encoding: " + encoding);
        encoding = (encoding + "").toLowerCase(), loweredCase = true;
    }
}
function swap(b, n, m) {
  let i2 = b[n];
  b[n] = b[m], b[m] = i2;
}
function bidirectionalIndexOf(buffer, val, byteOffset, encoding, dir) {
  if (buffer.length === 0)
    return -1;
  if (typeof byteOffset === "string")
    encoding = byteOffset, byteOffset = 0;
  else if (byteOffset > 2147483647)
    byteOffset = 2147483647;
  else if (byteOffset < -2147483648)
    byteOffset = -2147483648;
  if (byteOffset = +byteOffset, Number.isNaN(byteOffset))
    byteOffset = dir ? 0 : buffer.length - 1;
  if (byteOffset < 0)
    byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length)
    if (dir)
      return -1;
    else
      byteOffset = buffer.length - 1;
  else if (byteOffset < 0)
    if (dir)
      byteOffset = 0;
    else
      return -1;
  if (typeof val === "string")
    val = Buffer2.from(val, encoding);
  if (Buffer2.isBuffer(val)) {
    if (val.length === 0)
      return -1;
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir);
  } else if (typeof val === "number") {
    if (val = val & 255, typeof Uint8Array.prototype.indexOf === "function")
      if (dir)
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset);
      else
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset);
    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir);
  }
  throw TypeError("val must be string, number or Buffer");
}
function arrayIndexOf(arr, val, byteOffset, encoding, dir) {
  let indexSize = 1, arrLength = arr.length, valLength = val.length;
  if (encoding !== undefined) {
    if (encoding = String(encoding).toLowerCase(), encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
      if (arr.length < 2 || val.length < 2)
        return -1;
      indexSize = 2, arrLength /= 2, valLength /= 2, byteOffset /= 2;
    }
  }
  function read2(buf, i3) {
    if (indexSize === 1)
      return buf[i3];
    else
      return buf.readUInt16BE(i3 * indexSize);
  }
  let i2;
  if (dir) {
    let foundIndex = -1;
    for (i2 = byteOffset;i2 < arrLength; i2++)
      if (read2(arr, i2) === read2(val, foundIndex === -1 ? 0 : i2 - foundIndex)) {
        if (foundIndex === -1)
          foundIndex = i2;
        if (i2 - foundIndex + 1 === valLength)
          return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1)
          i2 -= i2 - foundIndex;
        foundIndex = -1;
      }
  } else {
    if (byteOffset + valLength > arrLength)
      byteOffset = arrLength - valLength;
    for (i2 = byteOffset;i2 >= 0; i2--) {
      let found = true;
      for (let j = 0;j < valLength; j++)
        if (read2(arr, i2 + j) !== read2(val, j)) {
          found = false;
          break;
        }
      if (found)
        return i2;
    }
  }
  return -1;
}
function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  let remaining = buf.length - offset;
  if (!length)
    length = remaining;
  else if (length = Number(length), length > remaining)
    length = remaining;
  let strLen = string.length;
  if (length > strLen / 2)
    length = strLen / 2;
  let i2;
  for (i2 = 0;i2 < length; ++i2) {
    let parsed = parseInt(string.substr(i2 * 2, 2), 16);
    if (Number.isNaN(parsed))
      return i2;
    buf[offset + i2] = parsed;
  }
  return i2;
}
function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}
function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}
function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}
function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}
function base64Slice(buf, start, end) {
  if (start === 0 && end === buf.length)
    return fromByteArray(buf);
  else
    return fromByteArray(buf.slice(start, end));
}
function utf8Slice(buf, start, end) {
  end = Math.min(buf.length, end);
  let res = [], i2 = start;
  while (i2 < end) {
    let firstByte = buf[i2], codePoint = null, bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
    if (i2 + bytesPerSequence <= end) {
      let secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128)
            codePoint = firstByte;
          break;
        case 2:
          if (secondByte = buf[i2 + 1], (secondByte & 192) === 128) {
            if (tempCodePoint = (firstByte & 31) << 6 | secondByte & 63, tempCodePoint > 127)
              codePoint = tempCodePoint;
          }
          break;
        case 3:
          if (secondByte = buf[i2 + 1], thirdByte = buf[i2 + 2], (secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            if (tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63, tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343))
              codePoint = tempCodePoint;
          }
          break;
        case 4:
          if (secondByte = buf[i2 + 1], thirdByte = buf[i2 + 2], fourthByte = buf[i2 + 3], (secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
            if (tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63, tempCodePoint > 65535 && tempCodePoint < 1114112)
              codePoint = tempCodePoint;
          }
      }
    }
    if (codePoint === null)
      codePoint = 65533, bytesPerSequence = 1;
    else if (codePoint > 65535)
      codePoint -= 65536, res.push(codePoint >>> 10 & 1023 | 55296), codePoint = 56320 | codePoint & 1023;
    res.push(codePoint), i2 += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}
function decodeCodePointsArray(codePoints) {
  let len2 = codePoints.length;
  if (len2 <= MAX_ARGUMENTS_LENGTH)
    return String.fromCharCode.apply(String, codePoints);
  let res = "", i2 = 0;
  while (i2 < len2)
    res += String.fromCharCode.apply(String, codePoints.slice(i2, i2 += MAX_ARGUMENTS_LENGTH));
  return res;
}
function asciiSlice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i2 = start;i2 < end; ++i2)
    ret += String.fromCharCode(buf[i2] & 127);
  return ret;
}
function latin1Slice(buf, start, end) {
  let ret = "";
  end = Math.min(buf.length, end);
  for (let i2 = start;i2 < end; ++i2)
    ret += String.fromCharCode(buf[i2]);
  return ret;
}
function hexSlice(buf, start, end) {
  let len2 = buf.length;
  if (!start || start < 0)
    start = 0;
  if (!end || end < 0 || end > len2)
    end = len2;
  let out = "";
  for (let i2 = start;i2 < end; ++i2)
    out += hexSliceLookupTable[buf[i2]];
  return out;
}
function utf16leSlice(buf, start, end) {
  let bytes = buf.slice(start, end), res = "";
  for (let i2 = 0;i2 < bytes.length - 1; i2 += 2)
    res += String.fromCharCode(bytes[i2] + bytes[i2 + 1] * 256);
  return res;
}
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0)
    throw RangeError("offset is not uint");
  if (offset + ext > length)
    throw RangeError("Trying to access beyond buffer length");
}
function checkInt(buf, value, offset, ext, max, min) {
  if (!Buffer2.isBuffer(buf))
    throw TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min)
    throw RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length)
    throw RangeError("Index out of range");
}
function wrtBigUInt64LE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo, lo = lo >> 8, buf[offset++] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  return buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, hi = hi >> 8, buf[offset++] = hi, offset;
}
function wrtBigUInt64BE(buf, value, offset, min, max) {
  checkIntBI(value, min, max, buf, offset, 7);
  let lo = Number(value & BigInt(4294967295));
  buf[offset + 7] = lo, lo = lo >> 8, buf[offset + 6] = lo, lo = lo >> 8, buf[offset + 5] = lo, lo = lo >> 8, buf[offset + 4] = lo;
  let hi = Number(value >> BigInt(32) & BigInt(4294967295));
  return buf[offset + 3] = hi, hi = hi >> 8, buf[offset + 2] = hi, hi = hi >> 8, buf[offset + 1] = hi, hi = hi >> 8, buf[offset] = hi, offset + 8;
}
function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length)
    throw RangeError("Index out of range");
  if (offset < 0)
    throw RangeError("Index out of range");
}
function writeFloat(buf, value, offset, littleEndian, noAssert) {
  if (value = +value, offset = offset >>> 0, !noAssert)
    checkIEEE754(buf, value, offset, 4, 340282346638528860000000000000000000000, -340282346638528860000000000000000000000);
  return write(buf, value, offset, littleEndian, 23, 4), offset + 4;
}
function writeDouble(buf, value, offset, littleEndian, noAssert) {
  if (value = +value, offset = offset >>> 0, !noAssert)
    checkIEEE754(buf, value, offset, 8, 179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000, -179769313486231570000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000);
  return write(buf, value, offset, littleEndian, 52, 8), offset + 8;
}
function addNumericalSeparator(val) {
  let res = "", i2 = val.length, start = val[0] === "-" ? 1 : 0;
  for (;i2 >= start + 4; i2 -= 3)
    res = `_${val.slice(i2 - 3, i2)}${res}`;
  return `${val.slice(0, i2)}${res}`;
}
function checkBounds(buf, offset, byteLength2) {
  if (validateNumber(offset, "offset"), buf[offset] === undefined || buf[offset + byteLength2] === undefined)
    boundsError(offset, buf.length - (byteLength2 + 1));
}
function checkIntBI(value, min, max, buf, offset, byteLength2) {
  if (value > max || value < min) {
    let n = typeof min === "bigint" ? "n" : "", range;
    if (byteLength2 > 3)
      if (min === 0 || min === BigInt(0))
        range = `>= 0${n} and < 2${n} ** ${(byteLength2 + 1) * 8}${n}`;
      else
        range = `>= -(2${n} ** ${(byteLength2 + 1) * 8 - 1}${n}) and < 2 ** ${(byteLength2 + 1) * 8 - 1}${n}`;
    else
      range = `>= ${min}${n} and <= ${max}${n}`;
    throw new ERR_OUT_OF_RANGE("value", range, value);
  }
  checkBounds(buf, offset, byteLength2);
}
function validateNumber(value, name) {
  if (typeof value !== "number")
    throw new ERR_INVALID_ARG_TYPE(name, "number", value);
}
function boundsError(value, length, type) {
  if (Math.floor(value) !== value)
    throw validateNumber(value, type), new ERR_OUT_OF_RANGE(type || "offset", "an integer", value);
  if (length < 0)
    throw new ERR_BUFFER_OUT_OF_BOUNDS;
  throw new ERR_OUT_OF_RANGE(type || "offset", `>= ${type ? 1 : 0} and <= ${length}`, value);
}
function base64clean(str) {
  if (str = str.split("=")[0], str = str.trim().replace(INVALID_BASE64_RE, ""), str.length < 2)
    return "";
  while (str.length % 4 !== 0)
    str = str + "=";
  return str;
}
function utf8ToBytes(string, units) {
  units = units || 1 / 0;
  let codePoint, length = string.length, leadSurrogate = null, bytes = [];
  for (let i2 = 0;i2 < length; ++i2) {
    if (codePoint = string.charCodeAt(i2), codePoint > 55295 && codePoint < 57344) {
      if (!leadSurrogate) {
        if (codePoint > 56319) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        } else if (i2 + 1 === length) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 56320) {
        if ((units -= 3) > -1)
          bytes.push(239, 191, 189);
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1)
        bytes.push(239, 191, 189);
    }
    if (leadSurrogate = null, codePoint < 128) {
      if ((units -= 1) < 0)
        break;
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      if ((units -= 2) < 0)
        break;
      bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128);
    } else if (codePoint < 65536) {
      if ((units -= 3) < 0)
        break;
      bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else if (codePoint < 1114112) {
      if ((units -= 4) < 0)
        break;
      bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else
      throw Error("Invalid code point");
  }
  return bytes;
}
function asciiToBytes(str) {
  let byteArray = [];
  for (let i2 = 0;i2 < str.length; ++i2)
    byteArray.push(str.charCodeAt(i2) & 255);
  return byteArray;
}
function utf16leToBytes(str, units) {
  let c, hi, lo, byteArray = [];
  for (let i2 = 0;i2 < str.length; ++i2) {
    if ((units -= 2) < 0)
      break;
    c = str.charCodeAt(i2), hi = c >> 8, lo = c % 256, byteArray.push(lo), byteArray.push(hi);
  }
  return byteArray;
}
function base64ToBytes(str) {
  return toByteArray(base64clean(str));
}
function blitBuffer(src, dst, offset, length) {
  let i2;
  for (i2 = 0;i2 < length; ++i2) {
    if (i2 + offset >= dst.length || i2 >= src.length)
      break;
    dst[i2 + offset] = src[i2];
  }
  return i2;
}
function isInstance(obj, type) {
  return obj instanceof type || obj != null && obj.constructor != null && obj.constructor.name != null && obj.constructor.name === type.name;
}
function defineBigIntMethod(fn) {
  return typeof BigInt > "u" ? BufferBigIntNotDefined : fn;
}
function BufferBigIntNotDefined() {
  throw Error("BigInt not supported");
}
function notimpl(name) {
  return () => {
    throw Error(name + " is not implemented for node:buffer browser polyfill");
  };
}
var lookup, revLookup, code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", i, len, customInspectSymbol, INSPECT_MAX_BYTES = 50, kMaxLength = 2147483647, kStringMaxLength = 536870888, btoa, atob, File, Blob2, constants, ERR_BUFFER_OUT_OF_BOUNDS, ERR_INVALID_ARG_TYPE, ERR_OUT_OF_RANGE, MAX_ARGUMENTS_LENGTH = 4096, INVALID_BASE64_RE, hexSliceLookupTable, resolveObjectURL, isUtf8, isAscii = (str) => {
  for (let char of str)
    if (char.charCodeAt(0) > 127)
      return false;
  return true;
}, transcode, buffer_default;
var init_buffer = __esm(() => {
  lookup = [];
  revLookup = [];
  for (i = 0, len = code.length;i < len; ++i)
    lookup[i] = code[i], revLookup[code.charCodeAt(i)] = i;
  revLookup[45] = 62;
  revLookup[95] = 63;
  customInspectSymbol = typeof Symbol === "function" && typeof Symbol.for === "function" ? Symbol.for("nodejs.util.inspect.custom") : null;
  btoa = globalThis.btoa;
  atob = globalThis.atob;
  File = globalThis.File;
  Blob2 = globalThis.Blob;
  constants = { MAX_LENGTH: kMaxLength, MAX_STRING_LENGTH: kStringMaxLength };
  ERR_BUFFER_OUT_OF_BOUNDS = E("ERR_BUFFER_OUT_OF_BOUNDS", function(name) {
    if (name)
      return `${name} is outside of buffer bounds`;
    return "Attempt to access memory outside buffer bounds";
  }, RangeError);
  ERR_INVALID_ARG_TYPE = E("ERR_INVALID_ARG_TYPE", function(name, actual) {
    return `The "${name}" argument must be of type number. Received type ${typeof actual}`;
  }, TypeError);
  ERR_OUT_OF_RANGE = E("ERR_OUT_OF_RANGE", function(str, range, input) {
    let msg = `The value of "${str}" is out of range.`, received = input;
    if (Number.isInteger(input) && Math.abs(input) > 4294967296)
      received = addNumericalSeparator(String(input));
    else if (typeof input === "bigint") {
      if (received = String(input), input > BigInt(2) ** BigInt(32) || input < -(BigInt(2) ** BigInt(32)))
        received = addNumericalSeparator(received);
      received += "n";
    }
    return msg += ` It must be ${range}. Received ${received}`, msg;
  }, RangeError);
  Object.defineProperty(Buffer2.prototype, "parent", { enumerable: true, get: function() {
    if (!Buffer2.isBuffer(this))
      return;
    return this.buffer;
  } });
  Object.defineProperty(Buffer2.prototype, "offset", { enumerable: true, get: function() {
    if (!Buffer2.isBuffer(this))
      return;
    return this.byteOffset;
  } });
  Buffer2.poolSize = 8192;
  Buffer2.from = function(value, encodingOrOffset, length) {
    return from(value, encodingOrOffset, length);
  };
  Object.setPrototypeOf(Buffer2.prototype, Uint8Array.prototype);
  Object.setPrototypeOf(Buffer2, Uint8Array);
  Buffer2.alloc = function(size, fill, encoding) {
    return alloc(size, fill, encoding);
  };
  Buffer2.allocUnsafe = function(size) {
    return allocUnsafe(size);
  };
  Buffer2.allocUnsafeSlow = function(size) {
    return allocUnsafe(size);
  };
  Buffer2.isBuffer = function(b) {
    return b != null && b._isBuffer === true && b !== Buffer2.prototype;
  };
  Buffer2.compare = function(a, b) {
    if (isInstance(a, Uint8Array))
      a = Buffer2.from(a, a.offset, a.byteLength);
    if (isInstance(b, Uint8Array))
      b = Buffer2.from(b, b.offset, b.byteLength);
    if (!Buffer2.isBuffer(a) || !Buffer2.isBuffer(b))
      throw TypeError('The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array');
    if (a === b)
      return 0;
    let x = a.length, y = b.length;
    for (let i2 = 0, len2 = Math.min(x, y);i2 < len2; ++i2)
      if (a[i2] !== b[i2]) {
        x = a[i2], y = b[i2];
        break;
      }
    if (x < y)
      return -1;
    if (y < x)
      return 1;
    return 0;
  };
  Buffer2.isEncoding = function(encoding) {
    switch (String(encoding).toLowerCase()) {
      case "hex":
      case "utf8":
      case "utf-8":
      case "ascii":
      case "latin1":
      case "binary":
      case "base64":
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return true;
      default:
        return false;
    }
  };
  Buffer2.concat = function(list, length) {
    if (!Array.isArray(list))
      throw TypeError('"list" argument must be an Array of Buffers');
    if (list.length === 0)
      return Buffer2.alloc(0);
    let i2;
    if (length === undefined) {
      length = 0;
      for (i2 = 0;i2 < list.length; ++i2)
        length += list[i2].length;
    }
    let buffer = Buffer2.allocUnsafe(length), pos = 0;
    for (i2 = 0;i2 < list.length; ++i2) {
      let buf = list[i2];
      if (isInstance(buf, Uint8Array))
        if (pos + buf.length > buffer.length) {
          if (!Buffer2.isBuffer(buf))
            buf = Buffer2.from(buf);
          buf.copy(buffer, pos);
        } else
          Uint8Array.prototype.set.call(buffer, buf, pos);
      else if (!Buffer2.isBuffer(buf))
        throw TypeError('"list" argument must be an Array of Buffers');
      else
        buf.copy(buffer, pos);
      pos += buf.length;
    }
    return buffer;
  };
  Buffer2.byteLength = byteLength;
  Buffer2.prototype._isBuffer = true;
  Buffer2.prototype.swap16 = function() {
    let len2 = this.length;
    if (len2 % 2 !== 0)
      throw RangeError("Buffer size must be a multiple of 16-bits");
    for (let i2 = 0;i2 < len2; i2 += 2)
      swap(this, i2, i2 + 1);
    return this;
  };
  Buffer2.prototype.swap32 = function() {
    let len2 = this.length;
    if (len2 % 4 !== 0)
      throw RangeError("Buffer size must be a multiple of 32-bits");
    for (let i2 = 0;i2 < len2; i2 += 4)
      swap(this, i2, i2 + 3), swap(this, i2 + 1, i2 + 2);
    return this;
  };
  Buffer2.prototype.swap64 = function() {
    let len2 = this.length;
    if (len2 % 8 !== 0)
      throw RangeError("Buffer size must be a multiple of 64-bits");
    for (let i2 = 0;i2 < len2; i2 += 8)
      swap(this, i2, i2 + 7), swap(this, i2 + 1, i2 + 6), swap(this, i2 + 2, i2 + 5), swap(this, i2 + 3, i2 + 4);
    return this;
  };
  Buffer2.prototype.toString = function() {
    let length = this.length;
    if (length === 0)
      return "";
    if (arguments.length === 0)
      return utf8Slice(this, 0, length);
    return slowToString.apply(this, arguments);
  };
  Buffer2.prototype.toLocaleString = Buffer2.prototype.toString;
  Buffer2.prototype.equals = function(b) {
    if (!Buffer2.isBuffer(b))
      throw TypeError("Argument must be a Buffer");
    if (this === b)
      return true;
    return Buffer2.compare(this, b) === 0;
  };
  Buffer2.prototype.inspect = function() {
    let str = "", max = INSPECT_MAX_BYTES;
    if (str = this.toString("hex", 0, max).replace(/(.{2})/g, "$1 ").trim(), this.length > max)
      str += " ... ";
    return "<Buffer " + str + ">";
  };
  if (customInspectSymbol)
    Buffer2.prototype[customInspectSymbol] = Buffer2.prototype.inspect;
  Buffer2.prototype.compare = function(target, start, end, thisStart, thisEnd) {
    if (isInstance(target, Uint8Array))
      target = Buffer2.from(target, target.offset, target.byteLength);
    if (!Buffer2.isBuffer(target))
      throw TypeError('The "target" argument must be one of type Buffer or Uint8Array. Received type ' + typeof target);
    if (start === undefined)
      start = 0;
    if (end === undefined)
      end = target ? target.length : 0;
    if (thisStart === undefined)
      thisStart = 0;
    if (thisEnd === undefined)
      thisEnd = this.length;
    if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length)
      throw RangeError("out of range index");
    if (thisStart >= thisEnd && start >= end)
      return 0;
    if (thisStart >= thisEnd)
      return -1;
    if (start >= end)
      return 1;
    if (start >>>= 0, end >>>= 0, thisStart >>>= 0, thisEnd >>>= 0, this === target)
      return 0;
    let x = thisEnd - thisStart, y = end - start, len2 = Math.min(x, y), thisCopy = this.slice(thisStart, thisEnd), targetCopy = target.slice(start, end);
    for (let i2 = 0;i2 < len2; ++i2)
      if (thisCopy[i2] !== targetCopy[i2]) {
        x = thisCopy[i2], y = targetCopy[i2];
        break;
      }
    if (x < y)
      return -1;
    if (y < x)
      return 1;
    return 0;
  };
  Buffer2.prototype.includes = function(val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1;
  };
  Buffer2.prototype.indexOf = function(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true);
  };
  Buffer2.prototype.lastIndexOf = function(val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, false);
  };
  Buffer2.prototype.write = function(string, offset, length, encoding) {
    if (offset === undefined)
      encoding = "utf8", length = this.length, offset = 0;
    else if (length === undefined && typeof offset === "string")
      encoding = offset, length = this.length, offset = 0;
    else if (isFinite(offset))
      if (offset = offset >>> 0, isFinite(length)) {
        if (length = length >>> 0, encoding === undefined)
          encoding = "utf8";
      } else
        encoding = length, length = undefined;
    else
      throw Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
    let remaining = this.length - offset;
    if (length === undefined || length > remaining)
      length = remaining;
    if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length)
      throw RangeError("Attempt to write outside buffer bounds");
    if (!encoding)
      encoding = "utf8";
    let loweredCase = false;
    for (;; )
      switch (encoding) {
        case "hex":
          return hexWrite(this, string, offset, length);
        case "utf8":
        case "utf-8":
          return utf8Write(this, string, offset, length);
        case "ascii":
        case "latin1":
        case "binary":
          return asciiWrite(this, string, offset, length);
        case "base64":
          return base64Write(this, string, offset, length);
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
          return ucs2Write(this, string, offset, length);
        default:
          if (loweredCase)
            throw TypeError("Unknown encoding: " + encoding);
          encoding = ("" + encoding).toLowerCase(), loweredCase = true;
      }
  };
  Buffer2.prototype.toJSON = function() {
    return { type: "Buffer", data: Array.prototype.slice.call(this._arr || this, 0) };
  };
  Buffer2.prototype.slice = function(start, end) {
    let len2 = this.length;
    if (start = ~~start, end = end === undefined ? len2 : ~~end, start < 0) {
      if (start += len2, start < 0)
        start = 0;
    } else if (start > len2)
      start = len2;
    if (end < 0) {
      if (end += len2, end < 0)
        end = 0;
    } else if (end > len2)
      end = len2;
    if (end < start)
      end = start;
    let newBuf = this.subarray(start, end);
    return Object.setPrototypeOf(newBuf, Buffer2.prototype), newBuf;
  };
  Buffer2.prototype.readUintLE = Buffer2.prototype.readUIntLE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let val = this[offset], mul = 1, i2 = 0;
    while (++i2 < byteLength2 && (mul *= 256))
      val += this[offset + i2] * mul;
    return val;
  };
  Buffer2.prototype.readUintBE = Buffer2.prototype.readUIntBE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let val = this[offset + --byteLength2], mul = 1;
    while (byteLength2 > 0 && (mul *= 256))
      val += this[offset + --byteLength2] * mul;
    return val;
  };
  Buffer2.prototype.readUint8 = Buffer2.prototype.readUInt8 = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 1, this.length);
    return this[offset];
  };
  Buffer2.prototype.readUint16LE = Buffer2.prototype.readUInt16LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    return this[offset] | this[offset + 1] << 8;
  };
  Buffer2.prototype.readUint16BE = Buffer2.prototype.readUInt16BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    return this[offset] << 8 | this[offset + 1];
  };
  Buffer2.prototype.readUint32LE = Buffer2.prototype.readUInt32LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
  };
  Buffer2.prototype.readUint32BE = Buffer2.prototype.readUInt32BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
  };
  Buffer2.prototype.readBigUInt64LE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let lo = first + this[++offset] * 256 + this[++offset] * 65536 + this[++offset] * 16777216, hi = this[++offset] + this[++offset] * 256 + this[++offset] * 65536 + last * 16777216;
    return BigInt(lo) + (BigInt(hi) << BigInt(32));
  });
  Buffer2.prototype.readBigUInt64BE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let hi = first * 16777216 + this[++offset] * 65536 + this[++offset] * 256 + this[++offset], lo = this[++offset] * 16777216 + this[++offset] * 65536 + this[++offset] * 256 + last;
    return (BigInt(hi) << BigInt(32)) + BigInt(lo);
  });
  Buffer2.prototype.readIntLE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let val = this[offset], mul = 1, i2 = 0;
    while (++i2 < byteLength2 && (mul *= 256))
      val += this[offset + i2] * mul;
    if (mul *= 128, val >= mul)
      val -= Math.pow(2, 8 * byteLength2);
    return val;
  };
  Buffer2.prototype.readIntBE = function(offset, byteLength2, noAssert) {
    if (offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert)
      checkOffset(offset, byteLength2, this.length);
    let i2 = byteLength2, mul = 1, val = this[offset + --i2];
    while (i2 > 0 && (mul *= 256))
      val += this[offset + --i2] * mul;
    if (mul *= 128, val >= mul)
      val -= Math.pow(2, 8 * byteLength2);
    return val;
  };
  Buffer2.prototype.readInt8 = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 1, this.length);
    if (!(this[offset] & 128))
      return this[offset];
    return (255 - this[offset] + 1) * -1;
  };
  Buffer2.prototype.readInt16LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    let val = this[offset] | this[offset + 1] << 8;
    return val & 32768 ? val | 4294901760 : val;
  };
  Buffer2.prototype.readInt16BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 2, this.length);
    let val = this[offset + 1] | this[offset] << 8;
    return val & 32768 ? val | 4294901760 : val;
  };
  Buffer2.prototype.readInt32LE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
  };
  Buffer2.prototype.readInt32BE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
  };
  Buffer2.prototype.readBigInt64LE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let val = this[offset + 4] + this[offset + 5] * 256 + this[offset + 6] * 65536 + (last << 24);
    return (BigInt(val) << BigInt(32)) + BigInt(first + this[++offset] * 256 + this[++offset] * 65536 + this[++offset] * 16777216);
  });
  Buffer2.prototype.readBigInt64BE = defineBigIntMethod(function(offset) {
    offset = offset >>> 0, validateNumber(offset, "offset");
    let first = this[offset], last = this[offset + 7];
    if (first === undefined || last === undefined)
      boundsError(offset, this.length - 8);
    let val = (first << 24) + this[++offset] * 65536 + this[++offset] * 256 + this[++offset];
    return (BigInt(val) << BigInt(32)) + BigInt(this[++offset] * 16777216 + this[++offset] * 65536 + this[++offset] * 256 + last);
  });
  Buffer2.prototype.readFloatLE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return read(this, offset, true, 23, 4);
  };
  Buffer2.prototype.readFloatBE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 4, this.length);
    return read(this, offset, false, 23, 4);
  };
  Buffer2.prototype.readDoubleLE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 8, this.length);
    return read(this, offset, true, 52, 8);
  };
  Buffer2.prototype.readDoubleBE = function(offset, noAssert) {
    if (offset = offset >>> 0, !noAssert)
      checkOffset(offset, 8, this.length);
    return read(this, offset, false, 52, 8);
  };
  Buffer2.prototype.writeUintLE = Buffer2.prototype.writeUIntLE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert) {
      let maxBytes = Math.pow(2, 8 * byteLength2) - 1;
      checkInt(this, value, offset, byteLength2, maxBytes, 0);
    }
    let mul = 1, i2 = 0;
    this[offset] = value & 255;
    while (++i2 < byteLength2 && (mul *= 256))
      this[offset + i2] = value / mul & 255;
    return offset + byteLength2;
  };
  Buffer2.prototype.writeUintBE = Buffer2.prototype.writeUIntBE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, byteLength2 = byteLength2 >>> 0, !noAssert) {
      let maxBytes = Math.pow(2, 8 * byteLength2) - 1;
      checkInt(this, value, offset, byteLength2, maxBytes, 0);
    }
    let i2 = byteLength2 - 1, mul = 1;
    this[offset + i2] = value & 255;
    while (--i2 >= 0 && (mul *= 256))
      this[offset + i2] = value / mul & 255;
    return offset + byteLength2;
  };
  Buffer2.prototype.writeUint8 = Buffer2.prototype.writeUInt8 = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 1, 255, 0);
    return this[offset] = value & 255, offset + 1;
  };
  Buffer2.prototype.writeUint16LE = Buffer2.prototype.writeUInt16LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 65535, 0);
    return this[offset] = value & 255, this[offset + 1] = value >>> 8, offset + 2;
  };
  Buffer2.prototype.writeUint16BE = Buffer2.prototype.writeUInt16BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 65535, 0);
    return this[offset] = value >>> 8, this[offset + 1] = value & 255, offset + 2;
  };
  Buffer2.prototype.writeUint32LE = Buffer2.prototype.writeUInt32LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 4294967295, 0);
    return this[offset + 3] = value >>> 24, this[offset + 2] = value >>> 16, this[offset + 1] = value >>> 8, this[offset] = value & 255, offset + 4;
  };
  Buffer2.prototype.writeUint32BE = Buffer2.prototype.writeUInt32BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 4294967295, 0);
    return this[offset] = value >>> 24, this[offset + 1] = value >>> 16, this[offset + 2] = value >>> 8, this[offset + 3] = value & 255, offset + 4;
  };
  Buffer2.prototype.writeBigUInt64LE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64LE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
  });
  Buffer2.prototype.writeBigUInt64BE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64BE(this, value, offset, BigInt(0), BigInt("0xffffffffffffffff"));
  });
  Buffer2.prototype.writeIntLE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert) {
      let limit = Math.pow(2, 8 * byteLength2 - 1);
      checkInt(this, value, offset, byteLength2, limit - 1, -limit);
    }
    let i2 = 0, mul = 1, sub = 0;
    this[offset] = value & 255;
    while (++i2 < byteLength2 && (mul *= 256)) {
      if (value < 0 && sub === 0 && this[offset + i2 - 1] !== 0)
        sub = 1;
      this[offset + i2] = (value / mul >> 0) - sub & 255;
    }
    return offset + byteLength2;
  };
  Buffer2.prototype.writeIntBE = function(value, offset, byteLength2, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert) {
      let limit = Math.pow(2, 8 * byteLength2 - 1);
      checkInt(this, value, offset, byteLength2, limit - 1, -limit);
    }
    let i2 = byteLength2 - 1, mul = 1, sub = 0;
    this[offset + i2] = value & 255;
    while (--i2 >= 0 && (mul *= 256)) {
      if (value < 0 && sub === 0 && this[offset + i2 + 1] !== 0)
        sub = 1;
      this[offset + i2] = (value / mul >> 0) - sub & 255;
    }
    return offset + byteLength2;
  };
  Buffer2.prototype.writeInt8 = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 1, 127, -128);
    if (value < 0)
      value = 255 + value + 1;
    return this[offset] = value & 255, offset + 1;
  };
  Buffer2.prototype.writeInt16LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 32767, -32768);
    return this[offset] = value & 255, this[offset + 1] = value >>> 8, offset + 2;
  };
  Buffer2.prototype.writeInt16BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 2, 32767, -32768);
    return this[offset] = value >>> 8, this[offset + 1] = value & 255, offset + 2;
  };
  Buffer2.prototype.writeInt32LE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 2147483647, -2147483648);
    return this[offset] = value & 255, this[offset + 1] = value >>> 8, this[offset + 2] = value >>> 16, this[offset + 3] = value >>> 24, offset + 4;
  };
  Buffer2.prototype.writeInt32BE = function(value, offset, noAssert) {
    if (value = +value, offset = offset >>> 0, !noAssert)
      checkInt(this, value, offset, 4, 2147483647, -2147483648);
    if (value < 0)
      value = 4294967295 + value + 1;
    return this[offset] = value >>> 24, this[offset + 1] = value >>> 16, this[offset + 2] = value >>> 8, this[offset + 3] = value & 255, offset + 4;
  };
  Buffer2.prototype.writeBigInt64LE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64LE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  });
  Buffer2.prototype.writeBigInt64BE = defineBigIntMethod(function(value, offset = 0) {
    return wrtBigUInt64BE(this, value, offset, -BigInt("0x8000000000000000"), BigInt("0x7fffffffffffffff"));
  });
  Buffer2.prototype.writeFloatLE = function(value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert);
  };
  Buffer2.prototype.writeFloatBE = function(value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert);
  };
  Buffer2.prototype.writeDoubleLE = function(value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert);
  };
  Buffer2.prototype.writeDoubleBE = function(value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert);
  };
  Buffer2.prototype.copy = function(target, targetStart, start, end) {
    if (!Buffer2.isBuffer(target))
      throw TypeError("argument should be a Buffer");
    if (!start)
      start = 0;
    if (!end && end !== 0)
      end = this.length;
    if (targetStart >= target.length)
      targetStart = target.length;
    if (!targetStart)
      targetStart = 0;
    if (end > 0 && end < start)
      end = start;
    if (end === start)
      return 0;
    if (target.length === 0 || this.length === 0)
      return 0;
    if (targetStart < 0)
      throw RangeError("targetStart out of bounds");
    if (start < 0 || start >= this.length)
      throw RangeError("Index out of range");
    if (end < 0)
      throw RangeError("sourceEnd out of bounds");
    if (end > this.length)
      end = this.length;
    if (target.length - targetStart < end - start)
      end = target.length - targetStart + start;
    let len2 = end - start;
    if (this === target && typeof Uint8Array.prototype.copyWithin === "function")
      this.copyWithin(targetStart, start, end);
    else
      Uint8Array.prototype.set.call(target, this.subarray(start, end), targetStart);
    return len2;
  };
  Buffer2.prototype.fill = function(val, start, end, encoding) {
    if (typeof val === "string") {
      if (typeof start === "string")
        encoding = start, start = 0, end = this.length;
      else if (typeof end === "string")
        encoding = end, end = this.length;
      if (encoding !== undefined && typeof encoding !== "string")
        throw TypeError("encoding must be a string");
      if (typeof encoding === "string" && !Buffer2.isEncoding(encoding))
        throw TypeError("Unknown encoding: " + encoding);
      if (val.length === 1) {
        let code2 = val.charCodeAt(0);
        if (encoding === "utf8" && code2 < 128 || encoding === "latin1")
          val = code2;
      }
    } else if (typeof val === "number")
      val = val & 255;
    else if (typeof val === "boolean")
      val = Number(val);
    if (start < 0 || this.length < start || this.length < end)
      throw RangeError("Out of range index");
    if (end <= start)
      return this;
    if (start = start >>> 0, end = end === undefined ? this.length : end >>> 0, !val)
      val = 0;
    let i2;
    if (typeof val === "number")
      for (i2 = start;i2 < end; ++i2)
        this[i2] = val;
    else {
      let bytes = Buffer2.isBuffer(val) ? val : Buffer2.from(val, encoding), len2 = bytes.length;
      if (len2 === 0)
        throw TypeError('The value "' + val + '" is invalid for argument "value"');
      for (i2 = 0;i2 < end - start; ++i2)
        this[i2 + start] = bytes[i2 % len2];
    }
    return this;
  };
  INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;
  hexSliceLookupTable = function() {
    let table = Array(256);
    for (let i2 = 0;i2 < 16; ++i2) {
      let i16 = i2 * 16;
      for (let j = 0;j < 16; ++j)
        table[i16 + j] = "0123456789abcdef"[i2] + "0123456789abcdef"[j];
    }
    return table;
  }();
  resolveObjectURL = notimpl("resolveObjectURL");
  isUtf8 = notimpl("isUtf8");
  transcode = notimpl("transcode");
  buffer_default = Buffer2;
});

// node:events
var exports_events = {};
__export(exports_events, {
  setMaxListeners: () => setMaxListeners2,
  once: () => once2,
  listenerCount: () => listenerCount2,
  init: () => EventEmitter,
  getMaxListeners: () => getMaxListeners2,
  getEventListeners: () => getEventListeners,
  default: () => events_default,
  captureRejectionSymbol: () => captureRejectionSymbol,
  addAbortListener: () => addAbortListener,
  EventEmitter: () => EventEmitter
});
function emitError(emitter, args) {
  var { _events: events } = emitter;
  if (args[0] ??= Error("Unhandled error."), !events)
    throw args[0];
  var errorMonitor = events[kErrorMonitor];
  if (errorMonitor)
    for (var handler of ArrayPrototypeSlice.call(errorMonitor))
      handler.apply(emitter, args);
  var handlers = events.error;
  if (!handlers)
    throw args[0];
  for (var handler of ArrayPrototypeSlice.call(handlers))
    handler.apply(emitter, args);
  return true;
}
function addCatch(emitter, promise, type, args) {
  promise.then(undefined, function(err) {
    queueMicrotask(() => emitUnhandledRejectionOrErr(emitter, err, type, args));
  });
}
function emitUnhandledRejectionOrErr(emitter, err, type, args) {
  if (typeof emitter[kRejection] === "function")
    emitter[kRejection](err, type, ...args);
  else
    try {
      emitter[kCapture] = false, emitter.emit("error", err);
    } finally {
      emitter[kCapture] = true;
    }
}
function overflowWarning(emitter, type, handlers) {
  handlers.warned = true;
  let warn = Error(`Possible EventEmitter memory leak detected. ${handlers.length} ${String(type)} listeners added to [${emitter.constructor.name}]. Use emitter.setMaxListeners() to increase limit`);
  warn.name = "MaxListenersExceededWarning", warn.emitter = emitter, warn.type = type, warn.count = handlers.length, console.warn(warn);
}
function onceWrapper(type, listener, ...args) {
  this.removeListener(type, listener), listener.apply(this, args);
}
function once2(emitter, type, options) {
  var signal = options?.signal;
  if (validateAbortSignal(signal, "options.signal"), signal?.aborted)
    throw new AbortError(undefined, { cause: signal?.reason });
  let { resolve, reject, promise } = $newPromiseCapability(Promise), errorListener = (err) => {
    if (emitter.removeListener(type, resolver), signal != null)
      eventTargetAgnosticRemoveListener(signal, "abort", abortListener);
    reject(err);
  }, resolver = (...args) => {
    if (typeof emitter.removeListener === "function")
      emitter.removeListener("error", errorListener);
    if (signal != null)
      eventTargetAgnosticRemoveListener(signal, "abort", abortListener);
    resolve(args);
  };
  if (eventTargetAgnosticAddListener(emitter, type, resolver, { once: true }), type !== "error" && typeof emitter.once === "function")
    emitter.once("error", errorListener);
  function abortListener() {
    eventTargetAgnosticRemoveListener(emitter, type, resolver), eventTargetAgnosticRemoveListener(emitter, "error", errorListener), reject(new AbortError(undefined, { cause: signal?.reason }));
  }
  if (signal != null)
    eventTargetAgnosticAddListener(signal, "abort", abortListener, { once: true });
  return promise;
}
function getEventListeners(emitter, type) {
  return emitter.listeners(type);
}
function setMaxListeners2(n, ...eventTargets) {
  validateNumber2(n, "setMaxListeners", 0);
  var length;
  if (eventTargets && (length = eventTargets.length))
    for (let i2 = 0;i2 < length; i2++)
      eventTargets[i2].setMaxListeners(n);
  else
    defaultMaxListeners = n;
}
function listenerCount2(emitter, type) {
  return emitter.listenerCount(type);
}
function eventTargetAgnosticRemoveListener(emitter, name, listener, flags) {
  if (typeof emitter.removeListener === "function")
    emitter.removeListener(name, listener);
  else
    emitter.removeEventListener(name, listener, flags);
}
function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === "function")
    if (flags.once)
      emitter.once(name, listener);
    else
      emitter.on(name, listener);
  else
    emitter.addEventListener(name, listener, flags);
}
function ERR_INVALID_ARG_TYPE2(name, type, value) {
  let err = TypeError(`The "${name}" argument must be of type ${type}. Received ${value}`);
  return err.code = "ERR_INVALID_ARG_TYPE", err;
}
function ERR_OUT_OF_RANGE2(name, range, value) {
  let err = RangeError(`The "${name}" argument is out of range. It must be ${range}. Received ${value}`);
  return err.code = "ERR_OUT_OF_RANGE", err;
}
function validateAbortSignal(signal, name) {
  if (signal !== undefined && (signal === null || typeof signal !== "object" || !("aborted" in signal)))
    throw ERR_INVALID_ARG_TYPE2(name, "AbortSignal", signal);
}
function validateNumber2(value, name, min, max) {
  if (typeof value !== "number")
    throw ERR_INVALID_ARG_TYPE2(name, "number", value);
  if (min != null && value < min || max != null && value > max || (min != null || max != null) && Number.isNaN(value))
    throw ERR_OUT_OF_RANGE2(name, `${min != null ? `>= ${min}` : ""}${min != null && max != null ? " && " : ""}${max != null ? `<= ${max}` : ""}`, value);
}
function checkListener(listener) {
  if (typeof listener !== "function")
    throw TypeError("The listener must be a function");
}
function validateBoolean(value, name) {
  if (typeof value !== "boolean")
    throw ERR_INVALID_ARG_TYPE2(name, "boolean", value);
}
function getMaxListeners2(emitterOrTarget) {
  return emitterOrTarget?._maxListeners ?? defaultMaxListeners;
}
function addAbortListener(signal, listener) {
  if (signal === undefined)
    throw ERR_INVALID_ARG_TYPE2("signal", "AbortSignal", signal);
  if (validateAbortSignal(signal, "signal"), typeof listener !== "function")
    throw ERR_INVALID_ARG_TYPE2("listener", "function", listener);
  let removeEventListener;
  if (signal.aborted)
    queueMicrotask(() => listener());
  else
    signal.addEventListener("abort", listener, { __proto__: null, once: true }), removeEventListener = () => {
      signal.removeEventListener("abort", listener);
    };
  return { __proto__: null, [Symbol.dispose]() {
    removeEventListener?.();
  } };
}
var SymbolFor, kCapture, kErrorMonitor, kMaxEventTargetListeners, kMaxEventTargetListenersWarned, kRejection, captureRejectionSymbol, ArrayPrototypeSlice, defaultMaxListeners = 10, EventEmitter = function(opts) {
  if (this._events === undefined || this._events === this.__proto__._events)
    this._events = { __proto__: null }, this._eventsCount = 0;
  if (this._maxListeners ??= undefined, this[kCapture] = opts?.captureRejections ? Boolean(opts?.captureRejections) : EventEmitterPrototype[kCapture])
    this.emit = emitWithRejectionCapture;
}, EventEmitterPrototype, emitWithoutRejectionCapture = function(type, ...args) {
  if (type === "error")
    return emitError(this, args);
  var { _events: events } = this;
  if (events === undefined)
    return false;
  var handlers = events[type];
  if (handlers === undefined)
    return false;
  let maybeClonedHandlers = handlers.length > 1 ? handlers.slice() : handlers;
  for (let i2 = 0, { length } = maybeClonedHandlers;i2 < length; i2++) {
    let handler = maybeClonedHandlers[i2];
    switch (args.length) {
      case 0:
        handler.call(this);
        break;
      case 1:
        handler.call(this, args[0]);
        break;
      case 2:
        handler.call(this, args[0], args[1]);
        break;
      case 3:
        handler.call(this, args[0], args[1], args[2]);
        break;
      default:
        handler.apply(this, args);
        break;
    }
  }
  return true;
}, emitWithRejectionCapture = function(type, ...args) {
  if (type === "error")
    return emitError(this, args);
  var { _events: events } = this;
  if (events === undefined)
    return false;
  var handlers = events[type];
  if (handlers === undefined)
    return false;
  let maybeClonedHandlers = handlers.length > 1 ? handlers.slice() : handlers;
  for (let i2 = 0, { length } = maybeClonedHandlers;i2 < length; i2++) {
    let handler = maybeClonedHandlers[i2], result;
    switch (args.length) {
      case 0:
        result = handler.call(this);
        break;
      case 1:
        result = handler.call(this, args[0]);
        break;
      case 2:
        result = handler.call(this, args[0], args[1]);
        break;
      case 3:
        result = handler.call(this, args[0], args[1], args[2]);
        break;
      default:
        result = handler.apply(this, args);
        break;
    }
    if (result !== undefined && typeof result?.then === "function" && result.then === Promise.prototype.then)
      addCatch(this, result, type, args);
  }
  return true;
}, AbortError, events_default;
var init_events = __esm(() => {
  SymbolFor = Symbol.for;
  kCapture = Symbol("kCapture");
  kErrorMonitor = SymbolFor("events.errorMonitor");
  kMaxEventTargetListeners = Symbol("events.maxEventTargetListeners");
  kMaxEventTargetListenersWarned = Symbol("events.maxEventTargetListenersWarned");
  kRejection = SymbolFor("nodejs.rejection");
  captureRejectionSymbol = SymbolFor("nodejs.rejection");
  ArrayPrototypeSlice = Array.prototype.slice;
  EventEmitterPrototype = EventEmitter.prototype = {};
  EventEmitterPrototype._events = undefined;
  EventEmitterPrototype._eventsCount = 0;
  EventEmitterPrototype._maxListeners = undefined;
  EventEmitterPrototype.setMaxListeners = function(n) {
    return validateNumber2(n, "setMaxListeners", 0), this._maxListeners = n, this;
  };
  EventEmitterPrototype.constructor = EventEmitter;
  EventEmitterPrototype.getMaxListeners = function() {
    return this?._maxListeners ?? defaultMaxListeners;
  };
  EventEmitterPrototype.emit = emitWithoutRejectionCapture;
  EventEmitterPrototype.addListener = function(type, fn) {
    checkListener(fn);
    var events = this._events;
    if (!events)
      events = this._events = { __proto__: null }, this._eventsCount = 0;
    else if (events.newListener)
      this.emit("newListener", type, fn.listener ?? fn);
    var handlers = events[type];
    if (!handlers)
      events[type] = [fn], this._eventsCount++;
    else {
      handlers.push(fn);
      var m = this._maxListeners ?? defaultMaxListeners;
      if (m > 0 && handlers.length > m && !handlers.warned)
        overflowWarning(this, type, handlers);
    }
    return this;
  };
  EventEmitterPrototype.on = EventEmitterPrototype.addListener;
  EventEmitterPrototype.prependListener = function(type, fn) {
    checkListener(fn);
    var events = this._events;
    if (!events)
      events = this._events = { __proto__: null }, this._eventsCount = 0;
    else if (events.newListener)
      this.emit("newListener", type, fn.listener ?? fn);
    var handlers = events[type];
    if (!handlers)
      events[type] = [fn], this._eventsCount++;
    else {
      handlers.unshift(fn);
      var m = this._maxListeners ?? defaultMaxListeners;
      if (m > 0 && handlers.length > m && !handlers.warned)
        overflowWarning(this, type, handlers);
    }
    return this;
  };
  EventEmitterPrototype.once = function(type, fn) {
    checkListener(fn);
    let bound = onceWrapper.bind(this, type, fn);
    return bound.listener = fn, this.addListener(type, bound), this;
  };
  EventEmitterPrototype.prependOnceListener = function(type, fn) {
    checkListener(fn);
    let bound = onceWrapper.bind(this, type, fn);
    return bound.listener = fn, this.prependListener(type, bound), this;
  };
  EventEmitterPrototype.removeListener = function(type, fn) {
    checkListener(fn);
    var { _events: events } = this;
    if (!events)
      return this;
    var handlers = events[type];
    if (!handlers)
      return this;
    var length = handlers.length;
    let position = -1;
    for (let i2 = length - 1;i2 >= 0; i2--)
      if (handlers[i2] === fn || handlers[i2].listener === fn) {
        position = i2;
        break;
      }
    if (position < 0)
      return this;
    if (position === 0)
      handlers.shift();
    else
      handlers.splice(position, 1);
    if (handlers.length === 0)
      delete events[type], this._eventsCount--;
    return this;
  };
  EventEmitterPrototype.off = EventEmitterPrototype.removeListener;
  EventEmitterPrototype.removeAllListeners = function(type) {
    var { _events: events } = this;
    if (type && events) {
      if (events[type])
        delete events[type], this._eventsCount--;
    } else
      this._events = { __proto__: null };
    return this;
  };
  EventEmitterPrototype.listeners = function(type) {
    var { _events: events } = this;
    if (!events)
      return [];
    var handlers = events[type];
    if (!handlers)
      return [];
    return handlers.map((x) => x.listener ?? x);
  };
  EventEmitterPrototype.rawListeners = function(type) {
    var { _events } = this;
    if (!_events)
      return [];
    var handlers = _events[type];
    if (!handlers)
      return [];
    return handlers.slice();
  };
  EventEmitterPrototype.listenerCount = function(type) {
    var { _events: events } = this;
    if (!events)
      return 0;
    return events[type]?.length ?? 0;
  };
  EventEmitterPrototype.eventNames = function() {
    return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
  };
  EventEmitterPrototype[kCapture] = false;
  AbortError = class AbortError extends Error {
    constructor(message = "The operation was aborted", options = undefined) {
      if (options !== undefined && typeof options !== "object")
        throw ERR_INVALID_ARG_TYPE2("options", "Object", options);
      super(message, options);
      this.code = "ABORT_ERR", this.name = "AbortError";
    }
  };
  Object.defineProperties(EventEmitter, { captureRejections: { get() {
    return EventEmitterPrototype[kCapture];
  }, set(value) {
    validateBoolean(value, "EventEmitter.captureRejections"), EventEmitterPrototype[kCapture] = value;
  }, enumerable: true }, defaultMaxListeners: { enumerable: true, get: () => {
    return defaultMaxListeners;
  }, set: (arg) => {
    validateNumber2(arg, "defaultMaxListeners", 0), defaultMaxListeners = arg;
  } }, kMaxEventTargetListeners: { value: kMaxEventTargetListeners, enumerable: false, configurable: false, writable: false }, kMaxEventTargetListenersWarned: { value: kMaxEventTargetListenersWarned, enumerable: false, configurable: false, writable: false } });
  Object.assign(EventEmitter, { once: once2, getEventListeners, getMaxListeners: getMaxListeners2, setMaxListeners: setMaxListeners2, EventEmitter, usingDomains: false, captureRejectionSymbol, errorMonitor: kErrorMonitor, addAbortListener, init: EventEmitter, listenerCount: listenerCount2 });
  events_default = EventEmitter;
});

// node:stream
var require_stream = __commonJS((exports, module) => {
  var __commonJS2 = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
  var require_primordials = __commonJS2((exports2, module2) => {

    class AggregateError extends Error {
      constructor(errors) {
        if (!Array.isArray(errors))
          throw TypeError(`Expected input to be an Array, got ${typeof errors}`);
        let message = "";
        for (let i2 = 0;i2 < errors.length; i2++)
          message += `    ${errors[i2].stack}
`;
        super(message);
        this.name = "AggregateError", this.errors = errors;
      }
    }
    module2.exports = { AggregateError, ArrayIsArray(self2) {
      return Array.isArray(self2);
    }, ArrayPrototypeIncludes(self2, el) {
      return self2.includes(el);
    }, ArrayPrototypeIndexOf(self2, el) {
      return self2.indexOf(el);
    }, ArrayPrototypeJoin(self2, sep) {
      return self2.join(sep);
    }, ArrayPrototypeMap(self2, fn) {
      return self2.map(fn);
    }, ArrayPrototypePop(self2, el) {
      return self2.pop(el);
    }, ArrayPrototypePush(self2, el) {
      return self2.push(el);
    }, ArrayPrototypeSlice(self2, start, end) {
      return self2.slice(start, end);
    }, Error, FunctionPrototypeCall(fn, thisArgs, ...args) {
      return fn.call(thisArgs, ...args);
    }, FunctionPrototypeSymbolHasInstance(self2, instance) {
      return Function.prototype[Symbol.hasInstance].call(self2, instance);
    }, MathFloor: Math.floor, Number, NumberIsInteger: Number.isInteger, NumberIsNaN: Number.isNaN, NumberMAX_SAFE_INTEGER: Number.MAX_SAFE_INTEGER, NumberMIN_SAFE_INTEGER: Number.MIN_SAFE_INTEGER, NumberParseInt: Number.parseInt, ObjectDefineProperties(self2, props) {
      return Object.defineProperties(self2, props);
    }, ObjectDefineProperty(self2, name, prop) {
      return Object.defineProperty(self2, name, prop);
    }, ObjectGetOwnPropertyDescriptor(self2, name) {
      return Object.getOwnPropertyDescriptor(self2, name);
    }, ObjectKeys(obj) {
      return Object.keys(obj);
    }, ObjectSetPrototypeOf(target, proto) {
      return Object.setPrototypeOf(target, proto);
    }, Promise, PromisePrototypeCatch(self2, fn) {
      return self2.catch(fn);
    }, PromisePrototypeThen(self2, thenFn, catchFn) {
      return self2.then(thenFn, catchFn);
    }, PromiseReject(err) {
      return Promise.reject(err);
    }, PromiseResolve(val) {
      return Promise.resolve(val);
    }, ReflectApply: Reflect.apply, RegExpPrototypeTest(self2, value) {
      return self2.test(value);
    }, SafeSet: Set, String, StringPrototypeSlice(self2, start, end) {
      return self2.slice(start, end);
    }, StringPrototypeToLowerCase(self2) {
      return self2.toLowerCase();
    }, StringPrototypeToUpperCase(self2) {
      return self2.toUpperCase();
    }, StringPrototypeTrim(self2) {
      return self2.trim();
    }, Symbol, SymbolFor: Symbol.for, SymbolAsyncIterator: Symbol.asyncIterator, SymbolHasInstance: Symbol.hasInstance, SymbolIterator: Symbol.iterator, SymbolDispose: Symbol.dispose || Symbol("Symbol.dispose"), SymbolAsyncDispose: Symbol.asyncDispose || Symbol("Symbol.asyncDispose"), TypedArrayPrototypeSet(self2, buf, len2) {
      return self2.set(buf, len2);
    }, Boolean, Uint8Array };
  });
  var require_inspect = __commonJS2((exports2, module2) => {
    module2.exports = { format(format, ...args) {
      return format.replace(/%([sdifj])/g, function(...[_unused, type]) {
        let replacement = args.shift();
        if (type === "f")
          return replacement.toFixed(6);
        else if (type === "j")
          return JSON.stringify(replacement);
        else if (type === "s" && typeof replacement === "object")
          return `${replacement.constructor !== Object ? replacement.constructor.name : ""} {}`.trim();
        else
          return replacement.toString();
      });
    }, inspect(value) {
      switch (typeof value) {
        case "string":
          if (value.includes("'")) {
            if (!value.includes('"'))
              return `"${value}"`;
            else if (!value.includes("`") && !value.includes("${"))
              return `\`${value}\``;
          }
          return `'${value}'`;
        case "number":
          if (isNaN(value))
            return "NaN";
          else if (Object.is(value, -0))
            return String(value);
          return value;
        case "bigint":
          return `${String(value)}n`;
        case "boolean":
        case "undefined":
          return String(value);
        case "object":
          return "{}";
      }
    } };
  });
  var require_errors = __commonJS2((exports2, module2) => {
    var { format, inspect } = require_inspect(), { AggregateError: CustomAggregateError } = require_primordials(), AggregateError = globalThis.AggregateError || CustomAggregateError, kIsNodeError = Symbol("kIsNodeError"), kTypes = ["string", "function", "number", "object", "Function", "Object", "boolean", "bigint", "symbol"], classRegExp = /^([A-Z][a-z0-9]*)+$/, codes = {};
    function assert(value, message) {
      if (!value)
        throw new codes.ERR_INTERNAL_ASSERTION(message);
    }
    function addNumericalSeparator2(val) {
      let res = "", i2 = val.length, start = val[0] === "-" ? 1 : 0;
      for (;i2 >= start + 4; i2 -= 3)
        res = `_${val.slice(i2 - 3, i2)}${res}`;
      return `${val.slice(0, i2)}${res}`;
    }
    function getMessage(key, msg, args) {
      if (typeof msg === "function")
        return assert(msg.length <= args.length, `Code: ${key}; The provided arguments length (${args.length}) does not match the required ones (${msg.length}).`), msg(...args);
      let expectedLength = (msg.match(/%[dfijoOs]/g) || []).length;
      if (assert(expectedLength === args.length, `Code: ${key}; The provided arguments length (${args.length}) does not match the required ones (${expectedLength}).`), args.length === 0)
        return msg;
      return format(msg, ...args);
    }
    function E2(code2, message, Base) {
      if (!Base)
        Base = Error;

      class NodeError extends Base {
        constructor(...args) {
          super(getMessage(code2, message, args));
        }
        toString() {
          return `${this.name} [${code2}]: ${this.message}`;
        }
      }
      Object.defineProperties(NodeError.prototype, { name: { value: Base.name, writable: true, enumerable: false, configurable: true }, toString: { value() {
        return `${this.name} [${code2}]: ${this.message}`;
      }, writable: true, enumerable: false, configurable: true } }), NodeError.prototype.code = code2, NodeError.prototype[kIsNodeError] = true, codes[code2] = NodeError;
    }
    function hideStackFrames(fn) {
      let hidden = "__node_internal_" + fn.name;
      return Object.defineProperty(fn, "name", { value: hidden }), fn;
    }
    function aggregateTwoErrors(innerError, outerError) {
      if (innerError && outerError && innerError !== outerError) {
        if (Array.isArray(outerError.errors))
          return outerError.errors.push(innerError), outerError;
        let err = new AggregateError([outerError, innerError], outerError.message);
        return err.code = outerError.code, err;
      }
      return innerError || outerError;
    }

    class AbortError2 extends Error {
      constructor(message = "The operation was aborted", options = undefined) {
        if (options !== undefined && typeof options !== "object")
          throw new codes.ERR_INVALID_ARG_TYPE("options", "Object", options);
        super(message, options);
        this.code = "ABORT_ERR", this.name = "AbortError";
      }
    }
    E2("ERR_ASSERTION", "%s", Error);
    E2("ERR_INVALID_ARG_TYPE", (name, expected, actual) => {
      if (assert(typeof name === "string", "'name' must be a string"), !Array.isArray(expected))
        expected = [expected];
      let msg = "The ";
      if (name.endsWith(" argument"))
        msg += `${name} `;
      else
        msg += `"${name}" ${name.includes(".") ? "property" : "argument"} `;
      msg += "must be ";
      let types = [], instances = [], other = [];
      for (let value of expected)
        if (assert(typeof value === "string", "All expected entries have to be of type string"), kTypes.includes(value))
          types.push(value.toLowerCase());
        else if (classRegExp.test(value))
          instances.push(value);
        else
          assert(value !== "object", 'The value "object" should be written as "Object"'), other.push(value);
      if (instances.length > 0) {
        let pos = types.indexOf("object");
        if (pos !== -1)
          types.splice(types, pos, 1), instances.push("Object");
      }
      if (types.length > 0) {
        switch (types.length) {
          case 1:
            msg += `of type ${types[0]}`;
            break;
          case 2:
            msg += `one of type ${types[0]} or ${types[1]}`;
            break;
          default: {
            let last = types.pop();
            msg += `one of type ${types.join(", ")}, or ${last}`;
          }
        }
        if (instances.length > 0 || other.length > 0)
          msg += " or ";
      }
      if (instances.length > 0) {
        switch (instances.length) {
          case 1:
            msg += `an instance of ${instances[0]}`;
            break;
          case 2:
            msg += `an instance of ${instances[0]} or ${instances[1]}`;
            break;
          default: {
            let last = instances.pop();
            msg += `an instance of ${instances.join(", ")}, or ${last}`;
          }
        }
        if (other.length > 0)
          msg += " or ";
      }
      switch (other.length) {
        case 0:
          break;
        case 1:
          if (other[0].toLowerCase() !== other[0])
            msg += "an ";
          msg += `${other[0]}`;
          break;
        case 2:
          msg += `one of ${other[0]} or ${other[1]}`;
          break;
        default: {
          let last = other.pop();
          msg += `one of ${other.join(", ")}, or ${last}`;
        }
      }
      if (actual == null)
        msg += `. Received ${actual}`;
      else if (typeof actual === "function" && actual.name)
        msg += `. Received function ${actual.name}`;
      else if (typeof actual === "object") {
        var _actual$constructor;
        if ((_actual$constructor = actual.constructor) !== null && _actual$constructor !== undefined && _actual$constructor.name)
          msg += `. Received an instance of ${actual.constructor.name}`;
        else {
          let inspected = inspect(actual, { depth: -1 });
          msg += `. Received ${inspected}`;
        }
      } else {
        let inspected = inspect(actual, { colors: false });
        if (inspected.length > 25)
          inspected = `${inspected.slice(0, 25)}...`;
        msg += `. Received type ${typeof actual} (${inspected})`;
      }
      return msg;
    }, TypeError);
    E2("ERR_INVALID_ARG_VALUE", (name, value, reason = "is invalid") => {
      let inspected = inspect(value);
      if (inspected.length > 128)
        inspected = inspected.slice(0, 128) + "...";
      return `The ${name.includes(".") ? "property" : "argument"} '${name}' ${reason}. Received ${inspected}`;
    }, TypeError);
    E2("ERR_INVALID_RETURN_VALUE", (input, name, value) => {
      var _value$constructor;
      let type = value !== null && value !== undefined && (_value$constructor = value.constructor) !== null && _value$constructor !== undefined && _value$constructor.name ? `instance of ${value.constructor.name}` : `type ${typeof value}`;
      return `Expected ${input} to be returned from the "${name}" function but got ${type}.`;
    }, TypeError);
    E2("ERR_MISSING_ARGS", (...args) => {
      assert(args.length > 0, "At least one arg needs to be specified");
      let msg, len2 = args.length;
      switch (args = (Array.isArray(args) ? args : [args]).map((a) => `"${a}"`).join(" or "), len2) {
        case 1:
          msg += `The ${args[0]} argument`;
          break;
        case 2:
          msg += `The ${args[0]} and ${args[1]} arguments`;
          break;
        default:
          {
            let last = args.pop();
            msg += `The ${args.join(", ")}, and ${last} arguments`;
          }
          break;
      }
      return `${msg} must be specified`;
    }, TypeError);
    E2("ERR_OUT_OF_RANGE", (str, range, input) => {
      assert(range, 'Missing "range" argument');
      let received;
      if (Number.isInteger(input) && Math.abs(input) > 4294967296)
        received = addNumericalSeparator2(String(input));
      else if (typeof input === "bigint") {
        received = String(input);
        let limit = BigInt(2) ** BigInt(32);
        if (input > limit || input < -limit)
          received = addNumericalSeparator2(received);
        received += "n";
      } else
        received = inspect(input);
      return `The value of "${str}" is out of range. It must be ${range}. Received ${received}`;
    }, RangeError);
    E2("ERR_MULTIPLE_CALLBACK", "Callback called multiple times", Error);
    E2("ERR_METHOD_NOT_IMPLEMENTED", "The %s method is not implemented", Error);
    E2("ERR_STREAM_ALREADY_FINISHED", "Cannot call %s after a stream was finished", Error);
    E2("ERR_STREAM_CANNOT_PIPE", "Cannot pipe, not readable", Error);
    E2("ERR_STREAM_DESTROYED", "Cannot call %s after a stream was destroyed", Error);
    E2("ERR_STREAM_NULL_VALUES", "May not write null values to stream", TypeError);
    E2("ERR_STREAM_PREMATURE_CLOSE", "Premature close", Error);
    E2("ERR_STREAM_PUSH_AFTER_EOF", "stream.push() after EOF", Error);
    E2("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", "stream.unshift() after end event", Error);
    E2("ERR_STREAM_WRITE_AFTER_END", "write after end", Error);
    E2("ERR_UNKNOWN_ENCODING", "Unknown encoding: %s", TypeError);
    module2.exports = { AbortError: AbortError2, aggregateTwoErrors: hideStackFrames(aggregateTwoErrors), hideStackFrames, codes };
  });
  var require_event_target_shim = __commonJS2((exports2, module2) => {
    Object.defineProperty(exports2, "__esModule", { value: true });
    var privateData = new WeakMap, wrappers = new WeakMap;
    function pd(event) {
      let retv = privateData.get(event);
      return console.assert(retv != null, "'this' is expected an Event object, but got", event), retv;
    }
    function setCancelFlag(data) {
      if (data.passiveListener != null) {
        if (typeof console < "u" && typeof console.error === "function")
          console.error("Unable to preventDefault inside passive event listener invocation.", data.passiveListener);
        return;
      }
      if (!data.event.cancelable)
        return;
      if (data.canceled = true, typeof data.event.preventDefault === "function")
        data.event.preventDefault();
    }
    function Event(eventTarget, event) {
      privateData.set(this, { eventTarget, event, eventPhase: 2, currentTarget: eventTarget, canceled: false, stopped: false, immediateStopped: false, passiveListener: null, timeStamp: event.timeStamp || Date.now() }), Object.defineProperty(this, "isTrusted", { value: false, enumerable: true });
      let keys = Object.keys(event);
      for (let i2 = 0;i2 < keys.length; ++i2) {
        let key = keys[i2];
        if (!(key in this))
          Object.defineProperty(this, key, defineRedirectDescriptor(key));
      }
    }
    Event.prototype = { get type() {
      return pd(this).event.type;
    }, get target() {
      return pd(this).eventTarget;
    }, get currentTarget() {
      return pd(this).currentTarget;
    }, composedPath() {
      let currentTarget = pd(this).currentTarget;
      if (currentTarget == null)
        return [];
      return [currentTarget];
    }, get NONE() {
      return 0;
    }, get CAPTURING_PHASE() {
      return 1;
    }, get AT_TARGET() {
      return 2;
    }, get BUBBLING_PHASE() {
      return 3;
    }, get eventPhase() {
      return pd(this).eventPhase;
    }, stopPropagation() {
      let data = pd(this);
      if (data.stopped = true, typeof data.event.stopPropagation === "function")
        data.event.stopPropagation();
    }, stopImmediatePropagation() {
      let data = pd(this);
      if (data.stopped = true, data.immediateStopped = true, typeof data.event.stopImmediatePropagation === "function")
        data.event.stopImmediatePropagation();
    }, get bubbles() {
      return Boolean(pd(this).event.bubbles);
    }, get cancelable() {
      return Boolean(pd(this).event.cancelable);
    }, preventDefault() {
      setCancelFlag(pd(this));
    }, get defaultPrevented() {
      return pd(this).canceled;
    }, get composed() {
      return Boolean(pd(this).event.composed);
    }, get timeStamp() {
      return pd(this).timeStamp;
    }, get srcElement() {
      return pd(this).eventTarget;
    }, get cancelBubble() {
      return pd(this).stopped;
    }, set cancelBubble(value) {
      if (!value)
        return;
      let data = pd(this);
      if (data.stopped = true, typeof data.event.cancelBubble === "boolean")
        data.event.cancelBubble = true;
    }, get returnValue() {
      return !pd(this).canceled;
    }, set returnValue(value) {
      if (!value)
        setCancelFlag(pd(this));
    }, initEvent() {} };
    Object.defineProperty(Event.prototype, "constructor", { value: Event, configurable: true, writable: true });
    if (typeof window < "u" && typeof window.Event < "u")
      Object.setPrototypeOf(Event.prototype, window.Event.prototype), wrappers.set(window.Event.prototype, Event);
    function defineRedirectDescriptor(key) {
      return { get() {
        return pd(this).event[key];
      }, set(value) {
        pd(this).event[key] = value;
      }, configurable: true, enumerable: true };
    }
    function defineCallDescriptor(key) {
      return { value() {
        let event = pd(this).event;
        return event[key].apply(event, arguments);
      }, configurable: true, enumerable: true };
    }
    function defineWrapper(BaseEvent, proto) {
      let keys = Object.keys(proto);
      if (keys.length === 0)
        return BaseEvent;
      function CustomEvent(eventTarget, event) {
        BaseEvent.call(this, eventTarget, event);
      }
      CustomEvent.prototype = Object.create(BaseEvent.prototype, { constructor: { value: CustomEvent, configurable: true, writable: true } });
      for (let i2 = 0;i2 < keys.length; ++i2) {
        let key = keys[i2];
        if (!(key in BaseEvent.prototype)) {
          let isFunc = typeof Object.getOwnPropertyDescriptor(proto, key).value === "function";
          Object.defineProperty(CustomEvent.prototype, key, isFunc ? defineCallDescriptor(key) : defineRedirectDescriptor(key));
        }
      }
      return CustomEvent;
    }
    function getWrapper(proto) {
      if (proto == null || proto === Object.prototype)
        return Event;
      let wrapper = wrappers.get(proto);
      if (wrapper == null)
        wrapper = defineWrapper(getWrapper(Object.getPrototypeOf(proto)), proto), wrappers.set(proto, wrapper);
      return wrapper;
    }
    function wrapEvent(eventTarget, event) {
      return new (getWrapper(Object.getPrototypeOf(event)))(eventTarget, event);
    }
    function isStopped(event) {
      return pd(event).immediateStopped;
    }
    function setEventPhase(event, eventPhase) {
      pd(event).eventPhase = eventPhase;
    }
    function setCurrentTarget(event, currentTarget) {
      pd(event).currentTarget = currentTarget;
    }
    function setPassiveListener(event, passiveListener) {
      pd(event).passiveListener = passiveListener;
    }
    var listenersMap = new WeakMap, CAPTURE = 1, BUBBLE = 2, ATTRIBUTE = 3;
    function isObject(x) {
      return x !== null && typeof x === "object";
    }
    function getListeners(eventTarget) {
      let listeners = listenersMap.get(eventTarget);
      if (listeners == null)
        throw TypeError("'this' is expected an EventTarget object, but got another value.");
      return listeners;
    }
    function defineEventAttributeDescriptor(eventName) {
      return { get() {
        let node = getListeners(this).get(eventName);
        while (node != null) {
          if (node.listenerType === ATTRIBUTE)
            return node.listener;
          node = node.next;
        }
        return null;
      }, set(listener) {
        if (typeof listener !== "function" && !isObject(listener))
          listener = null;
        let listeners = getListeners(this), prev = null, node = listeners.get(eventName);
        while (node != null) {
          if (node.listenerType === ATTRIBUTE)
            if (prev !== null)
              prev.next = node.next;
            else if (node.next !== null)
              listeners.set(eventName, node.next);
            else
              listeners.delete(eventName);
          else
            prev = node;
          node = node.next;
        }
        if (listener !== null) {
          let newNode = { listener, listenerType: ATTRIBUTE, passive: false, once: false, next: null };
          if (prev === null)
            listeners.set(eventName, newNode);
          else
            prev.next = newNode;
        }
      }, configurable: true, enumerable: true };
    }
    function defineEventAttribute(eventTargetPrototype, eventName) {
      Object.defineProperty(eventTargetPrototype, `on${eventName}`, defineEventAttributeDescriptor(eventName));
    }
    function defineCustomEventTarget(eventNames) {
      function CustomEventTarget() {
        EventTarget.call(this);
      }
      CustomEventTarget.prototype = Object.create(EventTarget.prototype, { constructor: { value: CustomEventTarget, configurable: true, writable: true } });
      for (let i2 = 0;i2 < eventNames.length; ++i2)
        defineEventAttribute(CustomEventTarget.prototype, eventNames[i2]);
      return CustomEventTarget;
    }
    function EventTarget() {
      if (this instanceof EventTarget) {
        listenersMap.set(this, new Map);
        return;
      }
      if (arguments.length === 1 && Array.isArray(arguments[0]))
        return defineCustomEventTarget(arguments[0]);
      if (arguments.length > 0) {
        let types = Array(arguments.length);
        for (let i2 = 0;i2 < arguments.length; ++i2)
          types[i2] = arguments[i2];
        return defineCustomEventTarget(types);
      }
      throw TypeError("Cannot call a class as a function");
    }
    EventTarget.prototype = { addEventListener(eventName, listener, options) {
      if (listener == null)
        return;
      if (typeof listener !== "function" && !isObject(listener))
        throw TypeError("'listener' should be a function or an object.");
      let listeners = getListeners(this), optionsIsObj = isObject(options), listenerType = (optionsIsObj ? Boolean(options.capture) : Boolean(options)) ? CAPTURE : BUBBLE, newNode = { listener, listenerType, passive: optionsIsObj && Boolean(options.passive), once: optionsIsObj && Boolean(options.once), next: null }, node = listeners.get(eventName);
      if (node === undefined) {
        listeners.set(eventName, newNode);
        return;
      }
      let prev = null;
      while (node != null) {
        if (node.listener === listener && node.listenerType === listenerType)
          return;
        prev = node, node = node.next;
      }
      prev.next = newNode;
    }, removeEventListener(eventName, listener, options) {
      if (listener == null)
        return;
      let listeners = getListeners(this), listenerType = (isObject(options) ? Boolean(options.capture) : Boolean(options)) ? CAPTURE : BUBBLE, prev = null, node = listeners.get(eventName);
      while (node != null) {
        if (node.listener === listener && node.listenerType === listenerType) {
          if (prev !== null)
            prev.next = node.next;
          else if (node.next !== null)
            listeners.set(eventName, node.next);
          else
            listeners.delete(eventName);
          return;
        }
        prev = node, node = node.next;
      }
    }, dispatchEvent(event) {
      if (event == null || typeof event.type !== "string")
        throw TypeError('"event.type" should be a string.');
      let listeners = getListeners(this), eventName = event.type, node = listeners.get(eventName);
      if (node == null)
        return true;
      let wrappedEvent = wrapEvent(this, event), prev = null;
      while (node != null) {
        if (node.once)
          if (prev !== null)
            prev.next = node.next;
          else if (node.next !== null)
            listeners.set(eventName, node.next);
          else
            listeners.delete(eventName);
        else
          prev = node;
        if (setPassiveListener(wrappedEvent, node.passive ? node.listener : null), typeof node.listener === "function")
          try {
            node.listener.call(this, wrappedEvent);
          } catch (err) {
            if (typeof console < "u" && typeof console.error === "function")
              console.error(err);
          }
        else if (node.listenerType !== ATTRIBUTE && typeof node.listener.handleEvent === "function")
          node.listener.handleEvent(wrappedEvent);
        if (isStopped(wrappedEvent))
          break;
        node = node.next;
      }
      return setPassiveListener(wrappedEvent, null), setEventPhase(wrappedEvent, 0), setCurrentTarget(wrappedEvent, null), !wrappedEvent.defaultPrevented;
    } };
    Object.defineProperty(EventTarget.prototype, "constructor", { value: EventTarget, configurable: true, writable: true });
    if (typeof window < "u" && typeof window.EventTarget < "u")
      Object.setPrototypeOf(EventTarget.prototype, window.EventTarget.prototype);
    exports2.defineEventAttribute = defineEventAttribute;
    exports2.EventTarget = EventTarget;
    exports2.default = EventTarget;
    module2.exports = EventTarget;
    module2.exports.EventTarget = module2.exports.default = EventTarget;
    module2.exports.defineEventAttribute = defineEventAttribute;
  });
  var require_abort_controller = __commonJS2((exports2, module2) => {
    Object.defineProperty(exports2, "__esModule", { value: true });
    var eventTargetShim = require_event_target_shim();

    class AbortSignal extends eventTargetShim.EventTarget {
      constructor() {
        super();
        throw TypeError("AbortSignal cannot be constructed directly");
      }
      get aborted() {
        let aborted = abortedFlags.get(this);
        if (typeof aborted !== "boolean")
          throw TypeError(`Expected 'this' to be an 'AbortSignal' object, but got ${this === null ? "null" : typeof this}`);
        return aborted;
      }
    }
    eventTargetShim.defineEventAttribute(AbortSignal.prototype, "abort");
    function createAbortSignal() {
      let signal = Object.create(AbortSignal.prototype);
      return eventTargetShim.EventTarget.call(signal), abortedFlags.set(signal, false), signal;
    }
    function abortSignal(signal) {
      if (abortedFlags.get(signal) !== false)
        return;
      abortedFlags.set(signal, true), signal.dispatchEvent({ type: "abort" });
    }
    var abortedFlags = new WeakMap;
    Object.defineProperties(AbortSignal.prototype, { aborted: { enumerable: true } });
    if (typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol")
      Object.defineProperty(AbortSignal.prototype, Symbol.toStringTag, { configurable: true, value: "AbortSignal" });

    class AbortController {
      constructor() {
        signals.set(this, createAbortSignal());
      }
      get signal() {
        return getSignal(this);
      }
      abort() {
        abortSignal(getSignal(this));
      }
    }
    var signals = new WeakMap;
    function getSignal(controller) {
      let signal = signals.get(controller);
      if (signal == null)
        throw TypeError(`Expected 'this' to be an 'AbortController' object, but got ${controller === null ? "null" : typeof controller}`);
      return signal;
    }
    Object.defineProperties(AbortController.prototype, { signal: { enumerable: true }, abort: { enumerable: true } });
    if (typeof Symbol === "function" && typeof Symbol.toStringTag === "symbol")
      Object.defineProperty(AbortController.prototype, Symbol.toStringTag, { configurable: true, value: "AbortController" });
    exports2.AbortController = AbortController;
    exports2.AbortSignal = AbortSignal;
    exports2.default = AbortController;
    module2.exports = AbortController;
    module2.exports.AbortController = module2.exports.default = AbortController;
    module2.exports.AbortSignal = AbortSignal;
  });
  var require_util = __commonJS2((exports2, module2) => {
    var bufferModule = (init_buffer(), __toCommonJS(exports_buffer)), { format, inspect } = require_inspect(), { codes: { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3 } } = require_errors(), { kResistStopPropagation, AggregateError, SymbolDispose } = require_primordials(), AbortSignal = globalThis.AbortSignal || require_abort_controller().AbortSignal, AbortController = globalThis.AbortController || require_abort_controller().AbortController, AsyncFunction = Object.getPrototypeOf(async function() {}).constructor, Blob3 = globalThis.Blob || bufferModule.Blob, isBlob = typeof Blob3 < "u" ? function(b) {
      return b instanceof Blob3;
    } : function(b) {
      return false;
    }, validateAbortSignal2 = (signal, name) => {
      if (signal !== undefined && (signal === null || typeof signal !== "object" || !("aborted" in signal)))
        throw new ERR_INVALID_ARG_TYPE3(name, "AbortSignal", signal);
    }, validateFunction = (value, name) => {
      if (typeof value !== "function")
        throw new ERR_INVALID_ARG_TYPE3(name, "Function", value);
    };
    module2.exports = { AggregateError, kEmptyObject: Object.freeze({}), once(callback) {
      let called = false;
      return function(...args) {
        if (called)
          return;
        called = true, callback.apply(this, args);
      };
    }, createDeferredPromise: function() {
      let resolve, reject;
      return { promise: new Promise((res, rej) => {
        resolve = res, reject = rej;
      }), resolve, reject };
    }, promisify(fn) {
      return new Promise((resolve, reject) => {
        fn((err, ...args) => {
          if (err)
            return reject(err);
          return resolve(...args);
        });
      });
    }, debuglog() {
      return function() {};
    }, format, inspect, types: { isAsyncFunction(fn) {
      return fn instanceof AsyncFunction;
    }, isArrayBufferView(arr) {
      return ArrayBuffer.isView(arr);
    } }, isBlob, deprecate(fn, message) {
      return fn;
    }, addAbortListener: (init_events(), __toCommonJS(exports_events)).addAbortListener || function(signal, listener) {
      if (signal === undefined)
        throw new ERR_INVALID_ARG_TYPE3("signal", "AbortSignal", signal);
      validateAbortSignal2(signal, "signal"), validateFunction(listener, "listener");
      let removeEventListener;
      if (signal.aborted)
        queueMicrotask(() => listener());
      else
        signal.addEventListener("abort", listener, { __proto__: null, once: true, [kResistStopPropagation]: true }), removeEventListener = () => {
          signal.removeEventListener("abort", listener);
        };
      return { __proto__: null, [SymbolDispose]() {
        var _removeEventListener;
        (_removeEventListener = removeEventListener) === null || _removeEventListener === undefined || _removeEventListener();
      } };
    }, AbortSignalAny: AbortSignal.any || function(signals) {
      if (signals.length === 1)
        return signals[0];
      let ac = new AbortController, abort = () => ac.abort();
      return signals.forEach((signal) => {
        validateAbortSignal2(signal, "signals"), signal.addEventListener("abort", abort, { once: true });
      }), ac.signal.addEventListener("abort", () => {
        signals.forEach((signal) => signal.removeEventListener("abort", abort));
      }, { once: true }), ac.signal;
    } };
    module2.exports.promisify.custom = Symbol.for("nodejs.util.promisify.custom");
  });
  var require_validators = __commonJS2((exports2, module2) => {
    var { ArrayIsArray, ArrayPrototypeIncludes, ArrayPrototypeJoin, ArrayPrototypeMap, NumberIsInteger, NumberIsNaN, NumberMAX_SAFE_INTEGER, NumberMIN_SAFE_INTEGER, NumberParseInt, ObjectPrototypeHasOwnProperty, RegExpPrototypeExec, String: String2, StringPrototypeToUpperCase, StringPrototypeTrim } = require_primordials(), { hideStackFrames, codes: { ERR_SOCKET_BAD_PORT, ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_INVALID_ARG_VALUE, ERR_OUT_OF_RANGE: ERR_OUT_OF_RANGE3, ERR_UNKNOWN_SIGNAL } } = require_errors(), { normalizeEncoding } = require_util(), { isAsyncFunction, isArrayBufferView } = require_util().types, signals = {};
    function isInt32(value) {
      return value === (value | 0);
    }
    function isUint32(value) {
      return value === value >>> 0;
    }
    var octalReg = /^[0-7]+$/, modeDesc = "must be a 32-bit unsigned integer or an octal string";
    function parseFileMode(value, name, def) {
      if (typeof value > "u")
        value = def;
      if (typeof value === "string") {
        if (RegExpPrototypeExec(octalReg, value) === null)
          throw new ERR_INVALID_ARG_VALUE(name, value, modeDesc);
        value = NumberParseInt(value, 8);
      }
      return validateUint32(value, name), value;
    }
    var validateInteger = hideStackFrames((value, name, min = NumberMIN_SAFE_INTEGER, max = NumberMAX_SAFE_INTEGER) => {
      if (typeof value !== "number")
        throw new ERR_INVALID_ARG_TYPE3(name, "number", value);
      if (!NumberIsInteger(value))
        throw new ERR_OUT_OF_RANGE3(name, "an integer", value);
      if (value < min || value > max)
        throw new ERR_OUT_OF_RANGE3(name, `>= ${min} && <= ${max}`, value);
    }), validateInt32 = hideStackFrames((value, name, min = -2147483648, max = 2147483647) => {
      if (typeof value !== "number")
        throw new ERR_INVALID_ARG_TYPE3(name, "number", value);
      if (!NumberIsInteger(value))
        throw new ERR_OUT_OF_RANGE3(name, "an integer", value);
      if (value < min || value > max)
        throw new ERR_OUT_OF_RANGE3(name, `>= ${min} && <= ${max}`, value);
    }), validateUint32 = hideStackFrames((value, name, positive = false) => {
      if (typeof value !== "number")
        throw new ERR_INVALID_ARG_TYPE3(name, "number", value);
      if (!NumberIsInteger(value))
        throw new ERR_OUT_OF_RANGE3(name, "an integer", value);
      let min = positive ? 1 : 0, max = 4294967295;
      if (value < min || value > max)
        throw new ERR_OUT_OF_RANGE3(name, `>= ${min} && <= ${max}`, value);
    });
    function validateString(value, name) {
      if (typeof value !== "string")
        throw new ERR_INVALID_ARG_TYPE3(name, "string", value);
    }
    function validateNumber3(value, name, min = undefined, max) {
      if (typeof value !== "number")
        throw new ERR_INVALID_ARG_TYPE3(name, "number", value);
      if (min != null && value < min || max != null && value > max || (min != null || max != null) && NumberIsNaN(value))
        throw new ERR_OUT_OF_RANGE3(name, `${min != null ? `>= ${min}` : ""}${min != null && max != null ? " && " : ""}${max != null ? `<= ${max}` : ""}`, value);
    }
    var validateOneOf = hideStackFrames((value, name, oneOf) => {
      if (!ArrayPrototypeIncludes(oneOf, value)) {
        let reason = "must be one of: " + ArrayPrototypeJoin(ArrayPrototypeMap(oneOf, (v) => typeof v === "string" ? `'${v}'` : String2(v)), ", ");
        throw new ERR_INVALID_ARG_VALUE(name, value, reason);
      }
    });
    function validateBoolean2(value, name) {
      if (typeof value !== "boolean")
        throw new ERR_INVALID_ARG_TYPE3(name, "boolean", value);
    }
    function getOwnPropertyValueOrDefault(options, key, defaultValue) {
      return options == null || !ObjectPrototypeHasOwnProperty(options, key) ? defaultValue : options[key];
    }
    var validateObject = hideStackFrames((value, name, options = null) => {
      let allowArray = getOwnPropertyValueOrDefault(options, "allowArray", false), allowFunction = getOwnPropertyValueOrDefault(options, "allowFunction", false);
      if (!getOwnPropertyValueOrDefault(options, "nullable", false) && value === null || !allowArray && ArrayIsArray(value) || typeof value !== "object" && (!allowFunction || typeof value !== "function"))
        throw new ERR_INVALID_ARG_TYPE3(name, "Object", value);
    }), validateDictionary = hideStackFrames((value, name) => {
      if (value != null && typeof value !== "object" && typeof value !== "function")
        throw new ERR_INVALID_ARG_TYPE3(name, "a dictionary", value);
    }), validateArray = hideStackFrames((value, name, minLength = 0) => {
      if (!ArrayIsArray(value))
        throw new ERR_INVALID_ARG_TYPE3(name, "Array", value);
      if (value.length < minLength) {
        let reason = `must be longer than ${minLength}`;
        throw new ERR_INVALID_ARG_VALUE(name, value, reason);
      }
    });
    function validateStringArray(value, name) {
      validateArray(value, name);
      for (let i2 = 0;i2 < value.length; i2++)
        validateString(value[i2], `${name}[${i2}]`);
    }
    function validateBooleanArray(value, name) {
      validateArray(value, name);
      for (let i2 = 0;i2 < value.length; i2++)
        validateBoolean2(value[i2], `${name}[${i2}]`);
    }
    function validateAbortSignalArray(value, name) {
      validateArray(value, name);
      for (let i2 = 0;i2 < value.length; i2++) {
        let signal = value[i2], indexedName = `${name}[${i2}]`;
        if (signal == null)
          throw new ERR_INVALID_ARG_TYPE3(indexedName, "AbortSignal", signal);
        validateAbortSignal2(signal, indexedName);
      }
    }
    function validateSignalName(signal, name = "signal") {
      if (validateString(signal, name), signals[signal] === undefined) {
        if (signals[StringPrototypeToUpperCase(signal)] !== undefined)
          throw new ERR_UNKNOWN_SIGNAL(signal + " (signals must use all capital letters)");
        throw new ERR_UNKNOWN_SIGNAL(signal);
      }
    }
    var validateBuffer = hideStackFrames((buffer, name = "buffer") => {
      if (!isArrayBufferView(buffer))
        throw new ERR_INVALID_ARG_TYPE3(name, ["Buffer", "TypedArray", "DataView"], buffer);
    });
    function validateEncoding(data, encoding) {
      let normalizedEncoding = normalizeEncoding(encoding), length = data.length;
      if (normalizedEncoding === "hex" && length % 2 !== 0)
        throw new ERR_INVALID_ARG_VALUE("encoding", encoding, `is invalid for data of length ${length}`);
    }
    function validatePort(port, name = "Port", allowZero = true) {
      if (typeof port !== "number" && typeof port !== "string" || typeof port === "string" && StringPrototypeTrim(port).length === 0 || +port !== +port >>> 0 || port > 65535 || port === 0 && !allowZero)
        throw new ERR_SOCKET_BAD_PORT(name, port, allowZero);
      return port | 0;
    }
    var validateAbortSignal2 = hideStackFrames((signal, name) => {
      if (signal !== undefined && (signal === null || typeof signal !== "object" || !("aborted" in signal)))
        throw new ERR_INVALID_ARG_TYPE3(name, "AbortSignal", signal);
    }), validateFunction = hideStackFrames((value, name) => {
      if (typeof value !== "function")
        throw new ERR_INVALID_ARG_TYPE3(name, "Function", value);
    }), validatePlainFunction = hideStackFrames((value, name) => {
      if (typeof value !== "function" || isAsyncFunction(value))
        throw new ERR_INVALID_ARG_TYPE3(name, "Function", value);
    }), validateUndefined = hideStackFrames((value, name) => {
      if (value !== undefined)
        throw new ERR_INVALID_ARG_TYPE3(name, "undefined", value);
    });
    function validateUnion(value, name, union) {
      if (!ArrayPrototypeIncludes(union, value))
        throw new ERR_INVALID_ARG_TYPE3(name, `('${ArrayPrototypeJoin(union, "|")}')`, value);
    }
    var linkValueRegExp = /^(?:<[^>]*>)(?:\s*;\s*[^;"\s]+(?:=(")?[^;"\s]*\1)?)*$/;
    function validateLinkHeaderFormat(value, name) {
      if (typeof value > "u" || !RegExpPrototypeExec(linkValueRegExp, value))
        throw new ERR_INVALID_ARG_VALUE(name, value, 'must be an array or string of format "</styles.css>; rel=preload; as=style"');
    }
    function validateLinkHeaderValue(hints) {
      if (typeof hints === "string")
        return validateLinkHeaderFormat(hints, "hints"), hints;
      else if (ArrayIsArray(hints)) {
        let hintsLength = hints.length, result = "";
        if (hintsLength === 0)
          return result;
        for (let i2 = 0;i2 < hintsLength; i2++) {
          let link = hints[i2];
          if (validateLinkHeaderFormat(link, "hints"), result += link, i2 !== hintsLength - 1)
            result += ", ";
        }
        return result;
      }
      throw new ERR_INVALID_ARG_VALUE("hints", hints, 'must be an array or string of format "</styles.css>; rel=preload; as=style"');
    }
    module2.exports = { isInt32, isUint32, parseFileMode, validateArray, validateStringArray, validateBooleanArray, validateAbortSignalArray, validateBoolean: validateBoolean2, validateBuffer, validateDictionary, validateEncoding, validateFunction, validateInt32, validateInteger, validateNumber: validateNumber3, validateObject, validateOneOf, validatePlainFunction, validatePort, validateSignalName, validateString, validateUint32, validateUndefined, validateUnion, validateAbortSignal: validateAbortSignal2, validateLinkHeaderValue };
  });
  var require_process = __commonJS2((exports2, module2) => {
    module2.exports = globalThis.process;
  });
  var require_utils = __commonJS2((exports2, module2) => {
    var { SymbolAsyncIterator, SymbolIterator, SymbolFor: SymbolFor2 } = require_primordials(), kIsDestroyed = SymbolFor2("nodejs.stream.destroyed"), kIsErrored = SymbolFor2("nodejs.stream.errored"), kIsReadable = SymbolFor2("nodejs.stream.readable"), kIsWritable = SymbolFor2("nodejs.stream.writable"), kIsDisturbed = SymbolFor2("nodejs.stream.disturbed"), kIsClosedPromise = SymbolFor2("nodejs.webstream.isClosedPromise"), kControllerErrorFunction = SymbolFor2("nodejs.webstream.controllerErrorFunction");
    function isReadableNodeStream(obj, strict = false) {
      var _obj$_readableState;
      return !!(obj && typeof obj.pipe === "function" && typeof obj.on === "function" && (!strict || typeof obj.pause === "function" && typeof obj.resume === "function") && (!obj._writableState || ((_obj$_readableState = obj._readableState) === null || _obj$_readableState === undefined ? undefined : _obj$_readableState.readable) !== false) && (!obj._writableState || obj._readableState));
    }
    function isWritableNodeStream(obj) {
      var _obj$_writableState;
      return !!(obj && typeof obj.write === "function" && typeof obj.on === "function" && (!obj._readableState || ((_obj$_writableState = obj._writableState) === null || _obj$_writableState === undefined ? undefined : _obj$_writableState.writable) !== false));
    }
    function isDuplexNodeStream(obj) {
      return !!(obj && typeof obj.pipe === "function" && obj._readableState && typeof obj.on === "function" && typeof obj.write === "function");
    }
    function isNodeStream(obj) {
      return obj && (obj._readableState || obj._writableState || typeof obj.write === "function" && typeof obj.on === "function" || typeof obj.pipe === "function" && typeof obj.on === "function");
    }
    function isReadableStream(obj) {
      return !!(obj && !isNodeStream(obj) && typeof obj.pipeThrough === "function" && typeof obj.getReader === "function" && typeof obj.cancel === "function");
    }
    function isWritableStream(obj) {
      return !!(obj && !isNodeStream(obj) && typeof obj.getWriter === "function" && typeof obj.abort === "function");
    }
    function isTransformStream(obj) {
      return !!(obj && !isNodeStream(obj) && typeof obj.readable === "object" && typeof obj.writable === "object");
    }
    function isWebStream(obj) {
      return isReadableStream(obj) || isWritableStream(obj) || isTransformStream(obj);
    }
    function isIterable(obj, isAsync) {
      if (obj == null)
        return false;
      if (isAsync === true)
        return typeof obj[SymbolAsyncIterator] === "function";
      if (isAsync === false)
        return typeof obj[SymbolIterator] === "function";
      return typeof obj[SymbolAsyncIterator] === "function" || typeof obj[SymbolIterator] === "function";
    }
    function isDestroyed(stream) {
      if (!isNodeStream(stream))
        return null;
      let { _writableState: wState, _readableState: rState } = stream, state = wState || rState;
      return !!(stream.destroyed || stream[kIsDestroyed] || state !== null && state !== undefined && state.destroyed);
    }
    function isWritableEnded(stream) {
      if (!isWritableNodeStream(stream))
        return null;
      if (stream.writableEnded === true)
        return true;
      let wState = stream._writableState;
      if (wState !== null && wState !== undefined && wState.errored)
        return false;
      if (typeof (wState === null || wState === undefined ? undefined : wState.ended) !== "boolean")
        return null;
      return wState.ended;
    }
    function isWritableFinished(stream, strict) {
      if (!isWritableNodeStream(stream))
        return null;
      if (stream.writableFinished === true)
        return true;
      let wState = stream._writableState;
      if (wState !== null && wState !== undefined && wState.errored)
        return false;
      if (typeof (wState === null || wState === undefined ? undefined : wState.finished) !== "boolean")
        return null;
      return !!(wState.finished || strict === false && wState.ended === true && wState.length === 0);
    }
    function isReadableEnded(stream) {
      if (!isReadableNodeStream(stream))
        return null;
      if (stream.readableEnded === true)
        return true;
      let rState = stream._readableState;
      if (!rState || rState.errored)
        return false;
      if (typeof (rState === null || rState === undefined ? undefined : rState.ended) !== "boolean")
        return null;
      return rState.ended;
    }
    function isReadableFinished(stream, strict) {
      if (!isReadableNodeStream(stream))
        return null;
      let rState = stream._readableState;
      if (rState !== null && rState !== undefined && rState.errored)
        return false;
      if (typeof (rState === null || rState === undefined ? undefined : rState.endEmitted) !== "boolean")
        return null;
      return !!(rState.endEmitted || strict === false && rState.ended === true && rState.length === 0);
    }
    function isReadable(stream) {
      if (stream && stream[kIsReadable] != null)
        return stream[kIsReadable];
      if (typeof (stream === null || stream === undefined ? undefined : stream.readable) !== "boolean")
        return null;
      if (isDestroyed(stream))
        return false;
      return isReadableNodeStream(stream) && stream.readable && !isReadableFinished(stream);
    }
    function isWritable(stream) {
      if (stream && stream[kIsWritable] != null)
        return stream[kIsWritable];
      if (typeof (stream === null || stream === undefined ? undefined : stream.writable) !== "boolean")
        return null;
      if (isDestroyed(stream))
        return false;
      return isWritableNodeStream(stream) && stream.writable && !isWritableEnded(stream);
    }
    function isFinished(stream, opts) {
      if (!isNodeStream(stream))
        return null;
      if (isDestroyed(stream))
        return true;
      if ((opts === null || opts === undefined ? undefined : opts.readable) !== false && isReadable(stream))
        return false;
      if ((opts === null || opts === undefined ? undefined : opts.writable) !== false && isWritable(stream))
        return false;
      return true;
    }
    function isWritableErrored(stream) {
      var _stream$_writableStat, _stream$_writableStat2;
      if (!isNodeStream(stream))
        return null;
      if (stream.writableErrored)
        return stream.writableErrored;
      return (_stream$_writableStat = (_stream$_writableStat2 = stream._writableState) === null || _stream$_writableStat2 === undefined ? undefined : _stream$_writableStat2.errored) !== null && _stream$_writableStat !== undefined ? _stream$_writableStat : null;
    }
    function isReadableErrored(stream) {
      var _stream$_readableStat, _stream$_readableStat2;
      if (!isNodeStream(stream))
        return null;
      if (stream.readableErrored)
        return stream.readableErrored;
      return (_stream$_readableStat = (_stream$_readableStat2 = stream._readableState) === null || _stream$_readableStat2 === undefined ? undefined : _stream$_readableStat2.errored) !== null && _stream$_readableStat !== undefined ? _stream$_readableStat : null;
    }
    function isClosed(stream) {
      if (!isNodeStream(stream))
        return null;
      if (typeof stream.closed === "boolean")
        return stream.closed;
      let { _writableState: wState, _readableState: rState } = stream;
      if (typeof (wState === null || wState === undefined ? undefined : wState.closed) === "boolean" || typeof (rState === null || rState === undefined ? undefined : rState.closed) === "boolean")
        return (wState === null || wState === undefined ? undefined : wState.closed) || (rState === null || rState === undefined ? undefined : rState.closed);
      if (typeof stream._closed === "boolean" && isOutgoingMessage(stream))
        return stream._closed;
      return null;
    }
    function isOutgoingMessage(stream) {
      return typeof stream._closed === "boolean" && typeof stream._defaultKeepAlive === "boolean" && typeof stream._removedConnection === "boolean" && typeof stream._removedContLen === "boolean";
    }
    function isServerResponse(stream) {
      return typeof stream._sent100 === "boolean" && isOutgoingMessage(stream);
    }
    function isServerRequest(stream) {
      var _stream$req;
      return typeof stream._consuming === "boolean" && typeof stream._dumped === "boolean" && ((_stream$req = stream.req) === null || _stream$req === undefined ? undefined : _stream$req.upgradeOrConnect) === undefined;
    }
    function willEmitClose(stream) {
      if (!isNodeStream(stream))
        return null;
      let { _writableState: wState, _readableState: rState } = stream, state = wState || rState;
      return !state && isServerResponse(stream) || !!(state && state.autoDestroy && state.emitClose && state.closed === false);
    }
    function isDisturbed(stream) {
      var _stream$kIsDisturbed;
      return !!(stream && ((_stream$kIsDisturbed = stream[kIsDisturbed]) !== null && _stream$kIsDisturbed !== undefined ? _stream$kIsDisturbed : stream.readableDidRead || stream.readableAborted));
    }
    function isErrored(stream) {
      var _ref, _ref2, _ref3, _ref4, _ref5, _stream$kIsErrored, _stream$_readableStat3, _stream$_writableStat3, _stream$_readableStat4, _stream$_writableStat4;
      return !!(stream && ((_ref = (_ref2 = (_ref3 = (_ref4 = (_ref5 = (_stream$kIsErrored = stream[kIsErrored]) !== null && _stream$kIsErrored !== undefined ? _stream$kIsErrored : stream.readableErrored) !== null && _ref5 !== undefined ? _ref5 : stream.writableErrored) !== null && _ref4 !== undefined ? _ref4 : (_stream$_readableStat3 = stream._readableState) === null || _stream$_readableStat3 === undefined ? undefined : _stream$_readableStat3.errorEmitted) !== null && _ref3 !== undefined ? _ref3 : (_stream$_writableStat3 = stream._writableState) === null || _stream$_writableStat3 === undefined ? undefined : _stream$_writableStat3.errorEmitted) !== null && _ref2 !== undefined ? _ref2 : (_stream$_readableStat4 = stream._readableState) === null || _stream$_readableStat4 === undefined ? undefined : _stream$_readableStat4.errored) !== null && _ref !== undefined ? _ref : (_stream$_writableStat4 = stream._writableState) === null || _stream$_writableStat4 === undefined ? undefined : _stream$_writableStat4.errored));
    }
    module2.exports = { isDestroyed, kIsDestroyed, isDisturbed, kIsDisturbed, isErrored, kIsErrored, isReadable, kIsReadable, kIsClosedPromise, kControllerErrorFunction, kIsWritable, isClosed, isDuplexNodeStream, isFinished, isIterable, isReadableNodeStream, isReadableStream, isReadableEnded, isReadableFinished, isReadableErrored, isNodeStream, isWebStream, isWritable, isWritableNodeStream, isWritableStream, isWritableEnded, isWritableFinished, isWritableErrored, isServerRequest, isServerResponse, willEmitClose, isTransformStream };
  });
  var require_end_of_stream = __commonJS2((exports2, module2) => {
    var process2 = require_process(), { AbortError: AbortError2, codes } = require_errors(), { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_STREAM_PREMATURE_CLOSE } = codes, { kEmptyObject, once } = require_util(), { validateAbortSignal: validateAbortSignal2, validateFunction, validateObject, validateBoolean: validateBoolean2 } = require_validators(), { Promise: Promise2, PromisePrototypeThen, SymbolDispose } = require_primordials(), { isClosed, isReadable, isReadableNodeStream, isReadableStream, isReadableFinished, isReadableErrored, isWritable, isWritableNodeStream, isWritableStream, isWritableFinished, isWritableErrored, isNodeStream, willEmitClose: _willEmitClose, kIsClosedPromise } = require_utils(), addAbortListener2;
    function isRequest(stream) {
      return stream.setHeader && typeof stream.abort === "function";
    }
    var nop = () => {};
    function eos(stream, options, callback) {
      var _options$readable, _options$writable;
      if (arguments.length === 2)
        callback = options, options = kEmptyObject;
      else if (options == null)
        options = kEmptyObject;
      else
        validateObject(options, "options");
      if (validateFunction(callback, "callback"), validateAbortSignal2(options.signal, "options.signal"), callback = once(callback), isReadableStream(stream) || isWritableStream(stream))
        return eosWeb(stream, options, callback);
      if (!isNodeStream(stream))
        throw new ERR_INVALID_ARG_TYPE3("stream", ["ReadableStream", "WritableStream", "Stream"], stream);
      let readable = (_options$readable = options.readable) !== null && _options$readable !== undefined ? _options$readable : isReadableNodeStream(stream), writable = (_options$writable = options.writable) !== null && _options$writable !== undefined ? _options$writable : isWritableNodeStream(stream), wState = stream._writableState, rState = stream._readableState, onlegacyfinish = () => {
        if (!stream.writable)
          onfinish();
      }, willEmitClose = _willEmitClose(stream) && isReadableNodeStream(stream) === readable && isWritableNodeStream(stream) === writable, writableFinished = isWritableFinished(stream, false), onfinish = () => {
        if (writableFinished = true, stream.destroyed)
          willEmitClose = false;
        if (willEmitClose && (!stream.readable || readable))
          return;
        if (!readable || readableFinished)
          callback.call(stream);
      }, readableFinished = isReadableFinished(stream, false), onend = () => {
        if (readableFinished = true, stream.destroyed)
          willEmitClose = false;
        if (willEmitClose && (!stream.writable || writable))
          return;
        if (!writable || writableFinished)
          callback.call(stream);
      }, onerror = (err) => {
        callback.call(stream, err);
      }, closed = isClosed(stream), onclose = () => {
        closed = true;
        let errored = isWritableErrored(stream) || isReadableErrored(stream);
        if (errored && typeof errored !== "boolean")
          return callback.call(stream, errored);
        if (readable && !readableFinished && isReadableNodeStream(stream, true)) {
          if (!isReadableFinished(stream, false))
            return callback.call(stream, new ERR_STREAM_PREMATURE_CLOSE);
        }
        if (writable && !writableFinished) {
          if (!isWritableFinished(stream, false))
            return callback.call(stream, new ERR_STREAM_PREMATURE_CLOSE);
        }
        callback.call(stream);
      }, onclosed = () => {
        closed = true;
        let errored = isWritableErrored(stream) || isReadableErrored(stream);
        if (errored && typeof errored !== "boolean")
          return callback.call(stream, errored);
        callback.call(stream);
      }, onrequest = () => {
        stream.req.on("finish", onfinish);
      };
      if (isRequest(stream)) {
        if (stream.on("complete", onfinish), !willEmitClose)
          stream.on("abort", onclose);
        if (stream.req)
          onrequest();
        else
          stream.on("request", onrequest);
      } else if (writable && !wState)
        stream.on("end", onlegacyfinish), stream.on("close", onlegacyfinish);
      if (!willEmitClose && typeof stream.aborted === "boolean")
        stream.on("aborted", onclose);
      if (stream.on("end", onend), stream.on("finish", onfinish), options.error !== false)
        stream.on("error", onerror);
      if (stream.on("close", onclose), closed)
        process2.nextTick(onclose);
      else if (wState !== null && wState !== undefined && wState.errorEmitted || rState !== null && rState !== undefined && rState.errorEmitted) {
        if (!willEmitClose)
          process2.nextTick(onclosed);
      } else if (!readable && (!willEmitClose || isReadable(stream)) && (writableFinished || isWritable(stream) === false))
        process2.nextTick(onclosed);
      else if (!writable && (!willEmitClose || isWritable(stream)) && (readableFinished || isReadable(stream) === false))
        process2.nextTick(onclosed);
      else if (rState && stream.req && stream.aborted)
        process2.nextTick(onclosed);
      let cleanup = () => {
        if (callback = nop, stream.removeListener("aborted", onclose), stream.removeListener("complete", onfinish), stream.removeListener("abort", onclose), stream.removeListener("request", onrequest), stream.req)
          stream.req.removeListener("finish", onfinish);
        stream.removeListener("end", onlegacyfinish), stream.removeListener("close", onlegacyfinish), stream.removeListener("finish", onfinish), stream.removeListener("end", onend), stream.removeListener("error", onerror), stream.removeListener("close", onclose);
      };
      if (options.signal && !closed) {
        let abort = () => {
          let endCallback = callback;
          cleanup(), endCallback.call(stream, new AbortError2(undefined, { cause: options.signal.reason }));
        };
        if (options.signal.aborted)
          process2.nextTick(abort);
        else {
          addAbortListener2 = addAbortListener2 || require_util().addAbortListener;
          let disposable = addAbortListener2(options.signal, abort), originalCallback = callback;
          callback = once((...args) => {
            disposable[SymbolDispose](), originalCallback.apply(stream, args);
          });
        }
      }
      return cleanup;
    }
    function eosWeb(stream, options, callback) {
      let isAborted = false, abort = nop;
      if (options.signal)
        if (abort = () => {
          isAborted = true, callback.call(stream, new AbortError2(undefined, { cause: options.signal.reason }));
        }, options.signal.aborted)
          process2.nextTick(abort);
        else {
          addAbortListener2 = addAbortListener2 || require_util().addAbortListener;
          let disposable = addAbortListener2(options.signal, abort), originalCallback = callback;
          callback = once((...args) => {
            disposable[SymbolDispose](), originalCallback.apply(stream, args);
          });
        }
      let resolverFn = (...args) => {
        if (!isAborted)
          process2.nextTick(() => callback.apply(stream, args));
      };
      return PromisePrototypeThen(stream[kIsClosedPromise].promise, resolverFn, resolverFn), nop;
    }
    function finished(stream, opts) {
      var _opts;
      let autoCleanup = false;
      if (opts === null)
        opts = kEmptyObject;
      if ((_opts = opts) !== null && _opts !== undefined && _opts.cleanup)
        validateBoolean2(opts.cleanup, "cleanup"), autoCleanup = opts.cleanup;
      return new Promise2((resolve, reject) => {
        let cleanup = eos(stream, opts, (err) => {
          if (autoCleanup)
            cleanup();
          if (err)
            reject(err);
          else
            resolve();
        });
      });
    }
    module2.exports = eos;
    module2.exports.finished = finished;
  });
  var require_destroy = __commonJS2((exports2, module2) => {
    var process2 = require_process(), { aggregateTwoErrors, codes: { ERR_MULTIPLE_CALLBACK }, AbortError: AbortError2 } = require_errors(), { Symbol: Symbol2 } = require_primordials(), { kIsDestroyed, isDestroyed, isFinished, isServerRequest } = require_utils(), kDestroy = Symbol2("kDestroy"), kConstruct = Symbol2("kConstruct");
    function checkError(err, w, r) {
      if (err) {
        if (err.stack, w && !w.errored)
          w.errored = err;
        if (r && !r.errored)
          r.errored = err;
      }
    }
    function destroy(err, cb) {
      let r = this._readableState, w = this._writableState, s = w || r;
      if (w !== null && w !== undefined && w.destroyed || r !== null && r !== undefined && r.destroyed) {
        if (typeof cb === "function")
          cb();
        return this;
      }
      if (checkError(err, w, r), w)
        w.destroyed = true;
      if (r)
        r.destroyed = true;
      if (!s.constructed)
        this.once(kDestroy, function(er) {
          _destroy(this, aggregateTwoErrors(er, err), cb);
        });
      else
        _destroy(this, err, cb);
      return this;
    }
    function _destroy(self2, err, cb) {
      let called = false;
      function onDestroy(err2) {
        if (called)
          return;
        called = true;
        let { _readableState: r, _writableState: w } = self2;
        if (checkError(err2, w, r), w)
          w.closed = true;
        if (r)
          r.closed = true;
        if (typeof cb === "function")
          cb(err2);
        if (err2)
          process2.nextTick(emitErrorCloseNT, self2, err2);
        else
          process2.nextTick(emitCloseNT, self2);
      }
      try {
        self2._destroy(err || null, onDestroy);
      } catch (err2) {
        onDestroy(err2);
      }
    }
    function emitErrorCloseNT(self2, err) {
      emitErrorNT(self2, err), emitCloseNT(self2);
    }
    function emitCloseNT(self2) {
      let { _readableState: r, _writableState: w } = self2;
      if (w)
        w.closeEmitted = true;
      if (r)
        r.closeEmitted = true;
      if (w !== null && w !== undefined && w.emitClose || r !== null && r !== undefined && r.emitClose)
        self2.emit("close");
    }
    function emitErrorNT(self2, err) {
      let { _readableState: r, _writableState: w } = self2;
      if (w !== null && w !== undefined && w.errorEmitted || r !== null && r !== undefined && r.errorEmitted)
        return;
      if (w)
        w.errorEmitted = true;
      if (r)
        r.errorEmitted = true;
      self2.emit("error", err);
    }
    function undestroy() {
      let r = this._readableState, w = this._writableState;
      if (r)
        r.constructed = true, r.closed = false, r.closeEmitted = false, r.destroyed = false, r.errored = null, r.errorEmitted = false, r.reading = false, r.ended = r.readable === false, r.endEmitted = r.readable === false;
      if (w)
        w.constructed = true, w.destroyed = false, w.closed = false, w.closeEmitted = false, w.errored = null, w.errorEmitted = false, w.finalCalled = false, w.prefinished = false, w.ended = w.writable === false, w.ending = w.writable === false, w.finished = w.writable === false;
    }
    function errorOrDestroy(stream, err, sync) {
      let { _readableState: r, _writableState: w } = stream;
      if (w !== null && w !== undefined && w.destroyed || r !== null && r !== undefined && r.destroyed)
        return this;
      if (r !== null && r !== undefined && r.autoDestroy || w !== null && w !== undefined && w.autoDestroy)
        stream.destroy(err);
      else if (err) {
        if (err.stack, w && !w.errored)
          w.errored = err;
        if (r && !r.errored)
          r.errored = err;
        if (sync)
          process2.nextTick(emitErrorNT, stream, err);
        else
          emitErrorNT(stream, err);
      }
    }
    function construct(stream, cb) {
      if (typeof stream._construct !== "function")
        return;
      let { _readableState: r, _writableState: w } = stream;
      if (r)
        r.constructed = false;
      if (w)
        w.constructed = false;
      if (stream.once(kConstruct, cb), stream.listenerCount(kConstruct) > 1)
        return;
      process2.nextTick(constructNT, stream);
    }
    function constructNT(stream) {
      let called = false;
      function onConstruct(err) {
        if (called) {
          errorOrDestroy(stream, err !== null && err !== undefined ? err : new ERR_MULTIPLE_CALLBACK);
          return;
        }
        called = true;
        let { _readableState: r, _writableState: w } = stream, s = w || r;
        if (r)
          r.constructed = true;
        if (w)
          w.constructed = true;
        if (s.destroyed)
          stream.emit(kDestroy, err);
        else if (err)
          errorOrDestroy(stream, err, true);
        else
          process2.nextTick(emitConstructNT, stream);
      }
      try {
        stream._construct((err) => {
          process2.nextTick(onConstruct, err);
        });
      } catch (err) {
        process2.nextTick(onConstruct, err);
      }
    }
    function emitConstructNT(stream) {
      stream.emit(kConstruct);
    }
    function isRequest(stream) {
      return (stream === null || stream === undefined ? undefined : stream.setHeader) && typeof stream.abort === "function";
    }
    function emitCloseLegacy(stream) {
      stream.emit("close");
    }
    function emitErrorCloseLegacy(stream, err) {
      stream.emit("error", err), process2.nextTick(emitCloseLegacy, stream);
    }
    function destroyer(stream, err) {
      if (!stream || isDestroyed(stream))
        return;
      if (!err && !isFinished(stream))
        err = new AbortError2;
      if (isServerRequest(stream))
        stream.socket = null, stream.destroy(err);
      else if (isRequest(stream))
        stream.abort();
      else if (isRequest(stream.req))
        stream.req.abort();
      else if (typeof stream.destroy === "function")
        stream.destroy(err);
      else if (typeof stream.close === "function")
        stream.close();
      else if (err)
        process2.nextTick(emitErrorCloseLegacy, stream, err);
      else
        process2.nextTick(emitCloseLegacy, stream);
      if (!stream.destroyed)
        stream[kIsDestroyed] = true;
    }
    module2.exports = { construct, destroyer, destroy, undestroy, errorOrDestroy };
  });
  var require_legacy = __commonJS2((exports2, module2) => {
    var { ArrayIsArray, ObjectSetPrototypeOf } = require_primordials(), { EventEmitter: EE } = (init_events(), __toCommonJS(exports_events));
    function Stream(opts) {
      EE.call(this, opts);
    }
    ObjectSetPrototypeOf(Stream.prototype, EE.prototype);
    ObjectSetPrototypeOf(Stream, EE);
    Stream.prototype.pipe = function(dest, options) {
      let source = this;
      function ondata(chunk) {
        if (dest.writable && dest.write(chunk) === false && source.pause)
          source.pause();
      }
      source.on("data", ondata);
      function ondrain() {
        if (source.readable && source.resume)
          source.resume();
      }
      if (dest.on("drain", ondrain), !dest._isStdio && (!options || options.end !== false))
        source.on("end", onend), source.on("close", onclose);
      let didOnEnd = false;
      function onend() {
        if (didOnEnd)
          return;
        didOnEnd = true, dest.end();
      }
      function onclose() {
        if (didOnEnd)
          return;
        if (didOnEnd = true, typeof dest.destroy === "function")
          dest.destroy();
      }
      function onerror(er) {
        if (cleanup(), EE.listenerCount(this, "error") === 0)
          this.emit("error", er);
      }
      prependListener(source, "error", onerror), prependListener(dest, "error", onerror);
      function cleanup() {
        source.removeListener("data", ondata), dest.removeListener("drain", ondrain), source.removeListener("end", onend), source.removeListener("close", onclose), source.removeListener("error", onerror), dest.removeListener("error", onerror), source.removeListener("end", cleanup), source.removeListener("close", cleanup), dest.removeListener("close", cleanup);
      }
      return source.on("end", cleanup), source.on("close", cleanup), dest.on("close", cleanup), dest.emit("pipe", source), dest;
    };
    function prependListener(emitter, event, fn) {
      if (typeof emitter.prependListener === "function")
        return emitter.prependListener(event, fn);
      if (!emitter._events || !emitter._events[event])
        emitter.on(event, fn);
      else if (ArrayIsArray(emitter._events[event]))
        emitter._events[event].unshift(fn);
      else
        emitter._events[event] = [fn, emitter._events[event]];
    }
    module2.exports = { Stream, prependListener };
  });
  var require_add_abort_signal = __commonJS2((exports2, module2) => {
    var { SymbolDispose } = require_primordials(), { AbortError: AbortError2, codes } = require_errors(), { isNodeStream, isWebStream, kControllerErrorFunction } = require_utils(), eos = require_end_of_stream(), { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3 } = codes, addAbortListener2, validateAbortSignal2 = (signal, name) => {
      if (typeof signal !== "object" || !("aborted" in signal))
        throw new ERR_INVALID_ARG_TYPE3(name, "AbortSignal", signal);
    };
    module2.exports.addAbortSignal = function(signal, stream) {
      if (validateAbortSignal2(signal, "signal"), !isNodeStream(stream) && !isWebStream(stream))
        throw new ERR_INVALID_ARG_TYPE3("stream", ["ReadableStream", "WritableStream", "Stream"], stream);
      return module2.exports.addAbortSignalNoValidate(signal, stream);
    };
    module2.exports.addAbortSignalNoValidate = function(signal, stream) {
      if (typeof signal !== "object" || !("aborted" in signal))
        return stream;
      let onAbort = isNodeStream(stream) ? () => {
        stream.destroy(new AbortError2(undefined, { cause: signal.reason }));
      } : () => {
        stream[kControllerErrorFunction](new AbortError2(undefined, { cause: signal.reason }));
      };
      if (signal.aborted)
        onAbort();
      else {
        addAbortListener2 = addAbortListener2 || require_util().addAbortListener;
        let disposable = addAbortListener2(signal, onAbort);
        eos(stream, disposable[SymbolDispose]);
      }
      return stream;
    };
  });
  var require_buffer_list = __commonJS2((exports2, module2) => {
    var { StringPrototypeSlice, SymbolIterator, TypedArrayPrototypeSet, Uint8Array: Uint8Array2 } = require_primordials(), { Buffer: Buffer3 } = (init_buffer(), __toCommonJS(exports_buffer)), { inspect } = require_util();
    module2.exports = class {
      constructor() {
        this.head = null, this.tail = null, this.length = 0;
      }
      push(v) {
        let entry = { data: v, next: null };
        if (this.length > 0)
          this.tail.next = entry;
        else
          this.head = entry;
        this.tail = entry, ++this.length;
      }
      unshift(v) {
        let entry = { data: v, next: this.head };
        if (this.length === 0)
          this.tail = entry;
        this.head = entry, ++this.length;
      }
      shift() {
        if (this.length === 0)
          return;
        let ret = this.head.data;
        if (this.length === 1)
          this.head = this.tail = null;
        else
          this.head = this.head.next;
        return --this.length, ret;
      }
      clear() {
        this.head = this.tail = null, this.length = 0;
      }
      join(s) {
        if (this.length === 0)
          return "";
        let p = this.head, ret = "" + p.data;
        while ((p = p.next) !== null)
          ret += s + p.data;
        return ret;
      }
      concat(n) {
        if (this.length === 0)
          return Buffer3.alloc(0);
        let ret = Buffer3.allocUnsafe(n >>> 0), p = this.head, i2 = 0;
        while (p)
          TypedArrayPrototypeSet(ret, p.data, i2), i2 += p.data.length, p = p.next;
        return ret;
      }
      consume(n, hasStrings) {
        let data = this.head.data;
        if (n < data.length) {
          let slice = data.slice(0, n);
          return this.head.data = data.slice(n), slice;
        }
        if (n === data.length)
          return this.shift();
        return hasStrings ? this._getString(n) : this._getBuffer(n);
      }
      first() {
        return this.head.data;
      }
      *[SymbolIterator]() {
        for (let p = this.head;p; p = p.next)
          yield p.data;
      }
      _getString(n) {
        let ret = "", p = this.head, c = 0;
        do {
          let str = p.data;
          if (n > str.length)
            ret += str, n -= str.length;
          else {
            if (n === str.length)
              if (ret += str, ++c, p.next)
                this.head = p.next;
              else
                this.head = this.tail = null;
            else
              ret += StringPrototypeSlice(str, 0, n), this.head = p, p.data = StringPrototypeSlice(str, n);
            break;
          }
          ++c;
        } while ((p = p.next) !== null);
        return this.length -= c, ret;
      }
      _getBuffer(n) {
        let ret = Buffer3.allocUnsafe(n), retLen = n, p = this.head, c = 0;
        do {
          let buf = p.data;
          if (n > buf.length)
            TypedArrayPrototypeSet(ret, buf, retLen - n), n -= buf.length;
          else {
            if (n === buf.length)
              if (TypedArrayPrototypeSet(ret, buf, retLen - n), ++c, p.next)
                this.head = p.next;
              else
                this.head = this.tail = null;
            else
              TypedArrayPrototypeSet(ret, new Uint8Array2(buf.buffer, buf.byteOffset, n), retLen - n), this.head = p, p.data = buf.slice(n);
            break;
          }
          ++c;
        } while ((p = p.next) !== null);
        return this.length -= c, ret;
      }
      [Symbol.for("nodejs.util.inspect.custom")](_, options) {
        return inspect(this, { ...options, depth: 0, customInspect: false });
      }
    };
  });
  var require_state = __commonJS2((exports2, module2) => {
    var { MathFloor, NumberIsInteger } = require_primordials(), { validateInteger } = require_validators(), { ERR_INVALID_ARG_VALUE } = require_errors().codes, defaultHighWaterMarkBytes = 16384, defaultHighWaterMarkObjectMode = 16;
    function highWaterMarkFrom(options, isDuplex, duplexKey) {
      return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
    }
    function getDefaultHighWaterMark(objectMode) {
      return objectMode ? defaultHighWaterMarkObjectMode : defaultHighWaterMarkBytes;
    }
    function setDefaultHighWaterMark(objectMode, value) {
      if (validateInteger(value, "value", 0), objectMode)
        defaultHighWaterMarkObjectMode = value;
      else
        defaultHighWaterMarkBytes = value;
    }
    function getHighWaterMark(state, options, duplexKey, isDuplex) {
      let hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
      if (hwm != null) {
        if (!NumberIsInteger(hwm) || hwm < 0) {
          let name = isDuplex ? `options.${duplexKey}` : "options.highWaterMark";
          throw new ERR_INVALID_ARG_VALUE(name, hwm);
        }
        return MathFloor(hwm);
      }
      return getDefaultHighWaterMark(state.objectMode);
    }
    module2.exports = { getHighWaterMark, getDefaultHighWaterMark, setDefaultHighWaterMark };
  });
  var require_safe_buffer = __commonJS2((exports2, module2) => {
    /*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
    var buffer = (init_buffer(), __toCommonJS(exports_buffer)), Buffer3 = buffer.Buffer;
    function copyProps(src, dst) {
      for (var key in src)
        dst[key] = src[key];
    }
    if (Buffer3.from && Buffer3.alloc && Buffer3.allocUnsafe && Buffer3.allocUnsafeSlow)
      module2.exports = buffer;
    else
      copyProps(buffer, exports2), exports2.Buffer = SafeBuffer;
    function SafeBuffer(arg, encodingOrOffset, length) {
      return Buffer3(arg, encodingOrOffset, length);
    }
    SafeBuffer.prototype = Object.create(Buffer3.prototype);
    copyProps(Buffer3, SafeBuffer);
    SafeBuffer.from = function(arg, encodingOrOffset, length) {
      if (typeof arg === "number")
        throw TypeError("Argument must not be a number");
      return Buffer3(arg, encodingOrOffset, length);
    };
    SafeBuffer.alloc = function(size, fill, encoding) {
      if (typeof size !== "number")
        throw TypeError("Argument must be a number");
      var buf = Buffer3(size);
      if (fill !== undefined)
        if (typeof encoding === "string")
          buf.fill(fill, encoding);
        else
          buf.fill(fill);
      else
        buf.fill(0);
      return buf;
    };
    SafeBuffer.allocUnsafe = function(size) {
      if (typeof size !== "number")
        throw TypeError("Argument must be a number");
      return Buffer3(size);
    };
    SafeBuffer.allocUnsafeSlow = function(size) {
      if (typeof size !== "number")
        throw TypeError("Argument must be a number");
      return buffer.SlowBuffer(size);
    };
  });
  var require_string_decoder = __commonJS2((exports2) => {
    var Buffer3 = require_safe_buffer().Buffer, isEncoding = Buffer3.isEncoding || function(encoding) {
      switch (encoding = "" + encoding, encoding && encoding.toLowerCase()) {
        case "hex":
        case "utf8":
        case "utf-8":
        case "ascii":
        case "binary":
        case "base64":
        case "ucs2":
        case "ucs-2":
        case "utf16le":
        case "utf-16le":
        case "raw":
          return true;
        default:
          return false;
      }
    };
    function _normalizeEncoding(enc) {
      if (!enc)
        return "utf8";
      var retried;
      while (true)
        switch (enc) {
          case "utf8":
          case "utf-8":
            return "utf8";
          case "ucs2":
          case "ucs-2":
          case "utf16le":
          case "utf-16le":
            return "utf16le";
          case "latin1":
          case "binary":
            return "latin1";
          case "base64":
          case "ascii":
          case "hex":
            return enc;
          default:
            if (retried)
              return;
            enc = ("" + enc).toLowerCase(), retried = true;
        }
    }
    function normalizeEncoding(enc) {
      var nenc = _normalizeEncoding(enc);
      if (typeof nenc !== "string" && (Buffer3.isEncoding === isEncoding || !isEncoding(enc)))
        throw Error("Unknown encoding: " + enc);
      return nenc || enc;
    }
    exports2.StringDecoder = StringDecoder;
    function StringDecoder(encoding) {
      this.encoding = normalizeEncoding(encoding);
      var nb;
      switch (this.encoding) {
        case "utf16le":
          this.text = utf16Text, this.end = utf16End, nb = 4;
          break;
        case "utf8":
          this.fillLast = utf8FillLast, nb = 4;
          break;
        case "base64":
          this.text = base64Text, this.end = base64End, nb = 3;
          break;
        default:
          this.write = simpleWrite, this.end = simpleEnd;
          return;
      }
      this.lastNeed = 0, this.lastTotal = 0, this.lastChar = Buffer3.allocUnsafe(nb);
    }
    StringDecoder.prototype.write = function(buf) {
      if (buf.length === 0)
        return "";
      var r, i2;
      if (this.lastNeed) {
        if (r = this.fillLast(buf), r === undefined)
          return "";
        i2 = this.lastNeed, this.lastNeed = 0;
      } else
        i2 = 0;
      if (i2 < buf.length)
        return r ? r + this.text(buf, i2) : this.text(buf, i2);
      return r || "";
    };
    StringDecoder.prototype.end = utf8End;
    StringDecoder.prototype.text = utf8Text;
    StringDecoder.prototype.fillLast = function(buf) {
      if (this.lastNeed <= buf.length)
        return buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length), this.lastNeed -= buf.length;
    };
    function utf8CheckByte(byte) {
      if (byte <= 127)
        return 0;
      else if (byte >> 5 === 6)
        return 2;
      else if (byte >> 4 === 14)
        return 3;
      else if (byte >> 3 === 30)
        return 4;
      return byte >> 6 === 2 ? -1 : -2;
    }
    function utf8CheckIncomplete(self2, buf, i2) {
      var j = buf.length - 1;
      if (j < i2)
        return 0;
      var nb = utf8CheckByte(buf[j]);
      if (nb >= 0) {
        if (nb > 0)
          self2.lastNeed = nb - 1;
        return nb;
      }
      if (--j < i2 || nb === -2)
        return 0;
      if (nb = utf8CheckByte(buf[j]), nb >= 0) {
        if (nb > 0)
          self2.lastNeed = nb - 2;
        return nb;
      }
      if (--j < i2 || nb === -2)
        return 0;
      if (nb = utf8CheckByte(buf[j]), nb >= 0) {
        if (nb > 0)
          if (nb === 2)
            nb = 0;
          else
            self2.lastNeed = nb - 3;
        return nb;
      }
      return 0;
    }
    function utf8CheckExtraBytes(self2, buf, p) {
      if ((buf[0] & 192) !== 128)
        return self2.lastNeed = 0, "�";
      if (self2.lastNeed > 1 && buf.length > 1) {
        if ((buf[1] & 192) !== 128)
          return self2.lastNeed = 1, "�";
        if (self2.lastNeed > 2 && buf.length > 2) {
          if ((buf[2] & 192) !== 128)
            return self2.lastNeed = 2, "�";
        }
      }
    }
    function utf8FillLast(buf) {
      var p = this.lastTotal - this.lastNeed, r = utf8CheckExtraBytes(this, buf, p);
      if (r !== undefined)
        return r;
      if (this.lastNeed <= buf.length)
        return buf.copy(this.lastChar, p, 0, this.lastNeed), this.lastChar.toString(this.encoding, 0, this.lastTotal);
      buf.copy(this.lastChar, p, 0, buf.length), this.lastNeed -= buf.length;
    }
    function utf8Text(buf, i2) {
      var total = utf8CheckIncomplete(this, buf, i2);
      if (!this.lastNeed)
        return buf.toString("utf8", i2);
      this.lastTotal = total;
      var end = buf.length - (total - this.lastNeed);
      return buf.copy(this.lastChar, 0, end), buf.toString("utf8", i2, end);
    }
    function utf8End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed)
        return r + "�";
      return r;
    }
    function utf16Text(buf, i2) {
      if ((buf.length - i2) % 2 === 0) {
        var r = buf.toString("utf16le", i2);
        if (r) {
          var c = r.charCodeAt(r.length - 1);
          if (c >= 55296 && c <= 56319)
            return this.lastNeed = 2, this.lastTotal = 4, this.lastChar[0] = buf[buf.length - 2], this.lastChar[1] = buf[buf.length - 1], r.slice(0, -1);
        }
        return r;
      }
      return this.lastNeed = 1, this.lastTotal = 2, this.lastChar[0] = buf[buf.length - 1], buf.toString("utf16le", i2, buf.length - 1);
    }
    function utf16End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed) {
        var end = this.lastTotal - this.lastNeed;
        return r + this.lastChar.toString("utf16le", 0, end);
      }
      return r;
    }
    function base64Text(buf, i2) {
      var n = (buf.length - i2) % 3;
      if (n === 0)
        return buf.toString("base64", i2);
      if (this.lastNeed = 3 - n, this.lastTotal = 3, n === 1)
        this.lastChar[0] = buf[buf.length - 1];
      else
        this.lastChar[0] = buf[buf.length - 2], this.lastChar[1] = buf[buf.length - 1];
      return buf.toString("base64", i2, buf.length - n);
    }
    function base64End(buf) {
      var r = buf && buf.length ? this.write(buf) : "";
      if (this.lastNeed)
        return r + this.lastChar.toString("base64", 0, 3 - this.lastNeed);
      return r;
    }
    function simpleWrite(buf) {
      return buf.toString(this.encoding);
    }
    function simpleEnd(buf) {
      return buf && buf.length ? this.write(buf) : "";
    }
  });
  var require_from = __commonJS2((exports2, module2) => {
    var process2 = require_process(), { PromisePrototypeThen, SymbolAsyncIterator, SymbolIterator } = require_primordials(), { Buffer: Buffer3 } = (init_buffer(), __toCommonJS(exports_buffer)), { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_STREAM_NULL_VALUES } = require_errors().codes;
    function from2(Readable, iterable, opts) {
      let iterator;
      if (typeof iterable === "string" || iterable instanceof Buffer3)
        return new Readable({ objectMode: true, ...opts, read() {
          this.push(iterable), this.push(null);
        } });
      let isAsync;
      if (iterable && iterable[SymbolAsyncIterator])
        isAsync = true, iterator = iterable[SymbolAsyncIterator]();
      else if (iterable && iterable[SymbolIterator])
        isAsync = false, iterator = iterable[SymbolIterator]();
      else
        throw new ERR_INVALID_ARG_TYPE3("iterable", ["Iterable"], iterable);
      let readable = new Readable({ objectMode: true, highWaterMark: 1, ...opts }), reading = false;
      readable._read = function() {
        if (!reading)
          reading = true, next();
      }, readable._destroy = function(error, cb) {
        PromisePrototypeThen(close(error), () => process2.nextTick(cb, error), (e) => process2.nextTick(cb, e || error));
      };
      async function close(error) {
        let hadError = error !== undefined && error !== null, hasThrow = typeof iterator.throw === "function";
        if (hadError && hasThrow) {
          let { value, done } = await iterator.throw(error);
          if (await value, done)
            return;
        }
        if (typeof iterator.return === "function") {
          let { value } = await iterator.return();
          await value;
        }
      }
      async function next() {
        for (;; ) {
          try {
            let { value, done } = isAsync ? await iterator.next() : iterator.next();
            if (done)
              readable.push(null);
            else {
              let res = value && typeof value.then === "function" ? await value : value;
              if (res === null)
                throw reading = false, new ERR_STREAM_NULL_VALUES;
              else if (readable.push(res))
                continue;
              else
                reading = false;
            }
          } catch (err) {
            readable.destroy(err);
          }
          break;
        }
      }
      return readable;
    }
    module2.exports = from2;
  });
  var require_readable = __commonJS2((exports2, module2) => {
    var process2 = require_process(), { ArrayPrototypeIndexOf, NumberIsInteger, NumberIsNaN, NumberParseInt, ObjectDefineProperties, ObjectKeys, ObjectSetPrototypeOf, Promise: Promise2, SafeSet, SymbolAsyncDispose, SymbolAsyncIterator, Symbol: Symbol2 } = require_primordials();
    module2.exports = Readable;
    Readable.ReadableState = ReadableState;
    var { EventEmitter: EE } = (init_events(), __toCommonJS(exports_events)), { Stream, prependListener } = require_legacy(), { Buffer: Buffer3 } = (init_buffer(), __toCommonJS(exports_buffer)), { addAbortSignal } = require_add_abort_signal(), eos = require_end_of_stream(), debug = require_util().debuglog("stream", (fn) => {
      debug = fn;
    }), BufferList = require_buffer_list(), destroyImpl = require_destroy(), { getHighWaterMark, getDefaultHighWaterMark } = require_state(), { aggregateTwoErrors, codes: { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_METHOD_NOT_IMPLEMENTED, ERR_OUT_OF_RANGE: ERR_OUT_OF_RANGE3, ERR_STREAM_PUSH_AFTER_EOF, ERR_STREAM_UNSHIFT_AFTER_END_EVENT }, AbortError: AbortError2 } = require_errors(), { validateObject } = require_validators(), kPaused = Symbol2("kPaused"), { StringDecoder } = require_string_decoder(), from2 = require_from();
    ObjectSetPrototypeOf(Readable.prototype, Stream.prototype);
    ObjectSetPrototypeOf(Readable, Stream);
    var nop = () => {}, { errorOrDestroy } = destroyImpl, kObjectMode = 1, kEnded = 2, kEndEmitted = 4, kReading = 8, kConstructed = 16, kSync = 32, kNeedReadable = 64, kEmittedReadable = 128, kReadableListening = 256, kResumeScheduled = 512, kErrorEmitted = 1024, kEmitClose = 2048, kAutoDestroy = 4096, kDestroyed = 8192, kClosed = 16384, kCloseEmitted = 32768, kMultiAwaitDrain = 65536, kReadingMore = 131072, kDataEmitted = 262144;
    function makeBitMapDescriptor(bit) {
      return { enumerable: false, get() {
        return (this.state & bit) !== 0;
      }, set(value) {
        if (value)
          this.state |= bit;
        else
          this.state &= ~bit;
      } };
    }
    ObjectDefineProperties(ReadableState.prototype, { objectMode: makeBitMapDescriptor(kObjectMode), ended: makeBitMapDescriptor(kEnded), endEmitted: makeBitMapDescriptor(kEndEmitted), reading: makeBitMapDescriptor(kReading), constructed: makeBitMapDescriptor(kConstructed), sync: makeBitMapDescriptor(kSync), needReadable: makeBitMapDescriptor(kNeedReadable), emittedReadable: makeBitMapDescriptor(kEmittedReadable), readableListening: makeBitMapDescriptor(kReadableListening), resumeScheduled: makeBitMapDescriptor(kResumeScheduled), errorEmitted: makeBitMapDescriptor(kErrorEmitted), emitClose: makeBitMapDescriptor(kEmitClose), autoDestroy: makeBitMapDescriptor(kAutoDestroy), destroyed: makeBitMapDescriptor(kDestroyed), closed: makeBitMapDescriptor(kClosed), closeEmitted: makeBitMapDescriptor(kCloseEmitted), multiAwaitDrain: makeBitMapDescriptor(kMultiAwaitDrain), readingMore: makeBitMapDescriptor(kReadingMore), dataEmitted: makeBitMapDescriptor(kDataEmitted) });
    function ReadableState(options, stream, isDuplex) {
      if (typeof isDuplex !== "boolean")
        isDuplex = stream instanceof require_duplex();
      if (this.state = kEmitClose | kAutoDestroy | kConstructed | kSync, options && options.objectMode)
        this.state |= kObjectMode;
      if (isDuplex && options && options.readableObjectMode)
        this.state |= kObjectMode;
      if (this.highWaterMark = options ? getHighWaterMark(this, options, "readableHighWaterMark", isDuplex) : getDefaultHighWaterMark(false), this.buffer = new BufferList, this.length = 0, this.pipes = [], this.flowing = null, this[kPaused] = null, options && options.emitClose === false)
        this.state &= ~kEmitClose;
      if (options && options.autoDestroy === false)
        this.state &= ~kAutoDestroy;
      if (this.errored = null, this.defaultEncoding = options && options.defaultEncoding || "utf8", this.awaitDrainWriters = null, this.decoder = null, this.encoding = null, options && options.encoding)
        this.decoder = new StringDecoder(options.encoding), this.encoding = options.encoding;
    }
    function Readable(options) {
      if (!(this instanceof Readable))
        return new Readable(options);
      let isDuplex = this instanceof require_duplex();
      if (this._readableState = new ReadableState(options, this, isDuplex), options) {
        if (typeof options.read === "function")
          this._read = options.read;
        if (typeof options.destroy === "function")
          this._destroy = options.destroy;
        if (typeof options.construct === "function")
          this._construct = options.construct;
        if (options.signal && !isDuplex)
          addAbortSignal(options.signal, this);
      }
      Stream.call(this, options), destroyImpl.construct(this, () => {
        if (this._readableState.needReadable)
          maybeReadMore(this, this._readableState);
      });
    }
    Readable.prototype.destroy = destroyImpl.destroy;
    Readable.prototype._undestroy = destroyImpl.undestroy;
    Readable.prototype._destroy = function(err, cb) {
      cb(err);
    };
    Readable.prototype[EE.captureRejectionSymbol] = function(err) {
      this.destroy(err);
    };
    Readable.prototype[SymbolAsyncDispose] = function() {
      let error;
      if (!this.destroyed)
        error = this.readableEnded ? null : new AbortError2, this.destroy(error);
      return new Promise2((resolve, reject) => eos(this, (err) => err && err !== error ? reject(err) : resolve(null)));
    };
    Readable.prototype.push = function(chunk, encoding) {
      return readableAddChunk(this, chunk, encoding, false);
    };
    Readable.prototype.unshift = function(chunk, encoding) {
      return readableAddChunk(this, chunk, encoding, true);
    };
    function readableAddChunk(stream, chunk, encoding, addToFront) {
      debug("readableAddChunk", chunk);
      let state = stream._readableState, err;
      if ((state.state & kObjectMode) === 0) {
        if (typeof chunk === "string") {
          if (encoding = encoding || state.defaultEncoding, state.encoding !== encoding)
            if (addToFront && state.encoding)
              chunk = Buffer3.from(chunk, encoding).toString(state.encoding);
            else
              chunk = Buffer3.from(chunk, encoding), encoding = "";
        } else if (chunk instanceof Buffer3)
          encoding = "";
        else if (Stream._isUint8Array(chunk))
          chunk = Stream._uint8ArrayToBuffer(chunk), encoding = "";
        else if (chunk != null)
          err = new ERR_INVALID_ARG_TYPE3("chunk", ["string", "Buffer", "Uint8Array"], chunk);
      }
      if (err)
        errorOrDestroy(stream, err);
      else if (chunk === null)
        state.state &= ~kReading, onEofChunk(stream, state);
      else if ((state.state & kObjectMode) !== 0 || chunk && chunk.length > 0)
        if (addToFront)
          if ((state.state & kEndEmitted) !== 0)
            errorOrDestroy(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT);
          else if (state.destroyed || state.errored)
            return false;
          else
            addChunk(stream, state, chunk, true);
        else if (state.ended)
          errorOrDestroy(stream, new ERR_STREAM_PUSH_AFTER_EOF);
        else if (state.destroyed || state.errored)
          return false;
        else if (state.state &= ~kReading, state.decoder && !encoding)
          if (chunk = state.decoder.write(chunk), state.objectMode || chunk.length !== 0)
            addChunk(stream, state, chunk, false);
          else
            maybeReadMore(stream, state);
        else
          addChunk(stream, state, chunk, false);
      else if (!addToFront)
        state.state &= ~kReading, maybeReadMore(stream, state);
      return !state.ended && (state.length < state.highWaterMark || state.length === 0);
    }
    function addChunk(stream, state, chunk, addToFront) {
      if (state.flowing && state.length === 0 && !state.sync && stream.listenerCount("data") > 0) {
        if ((state.state & kMultiAwaitDrain) !== 0)
          state.awaitDrainWriters.clear();
        else
          state.awaitDrainWriters = null;
        state.dataEmitted = true, stream.emit("data", chunk);
      } else {
        if (state.length += state.objectMode ? 1 : chunk.length, addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);
        if ((state.state & kNeedReadable) !== 0)
          emitReadable(stream);
      }
      maybeReadMore(stream, state);
    }
    Readable.prototype.isPaused = function() {
      let state = this._readableState;
      return state[kPaused] === true || state.flowing === false;
    };
    Readable.prototype.setEncoding = function(enc) {
      let decoder = new StringDecoder(enc);
      this._readableState.decoder = decoder, this._readableState.encoding = this._readableState.decoder.encoding;
      let buffer = this._readableState.buffer, content = "";
      for (let data of buffer)
        content += decoder.write(data);
      if (buffer.clear(), content !== "")
        buffer.push(content);
      return this._readableState.length = content.length, this;
    };
    var MAX_HWM = 1073741824;
    function computeNewHighWaterMark(n) {
      if (n > MAX_HWM)
        throw new ERR_OUT_OF_RANGE3("size", "<= 1GiB", n);
      else
        n--, n |= n >>> 1, n |= n >>> 2, n |= n >>> 4, n |= n >>> 8, n |= n >>> 16, n++;
      return n;
    }
    function howMuchToRead(n, state) {
      if (n <= 0 || state.length === 0 && state.ended)
        return 0;
      if ((state.state & kObjectMode) !== 0)
        return 1;
      if (NumberIsNaN(n)) {
        if (state.flowing && state.length)
          return state.buffer.first().length;
        return state.length;
      }
      if (n <= state.length)
        return n;
      return state.ended ? state.length : 0;
    }
    Readable.prototype.read = function(n) {
      if (debug("read", n), n === undefined)
        n = NaN;
      else if (!NumberIsInteger(n))
        n = NumberParseInt(n, 10);
      let state = this._readableState, nOrig = n;
      if (n > state.highWaterMark)
        state.highWaterMark = computeNewHighWaterMark(n);
      if (n !== 0)
        state.state &= ~kEmittedReadable;
      if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
        if (debug("read: emitReadable", state.length, state.ended), state.length === 0 && state.ended)
          endReadable(this);
        else
          emitReadable(this);
        return null;
      }
      if (n = howMuchToRead(n, state), n === 0 && state.ended) {
        if (state.length === 0)
          endReadable(this);
        return null;
      }
      let doRead = (state.state & kNeedReadable) !== 0;
      if (debug("need readable", doRead), state.length === 0 || state.length - n < state.highWaterMark)
        doRead = true, debug("length less than watermark", doRead);
      if (state.ended || state.reading || state.destroyed || state.errored || !state.constructed)
        doRead = false, debug("reading, ended or constructing", doRead);
      else if (doRead) {
        if (debug("do read"), state.state |= kReading | kSync, state.length === 0)
          state.state |= kNeedReadable;
        try {
          this._read(state.highWaterMark);
        } catch (err) {
          errorOrDestroy(this, err);
        }
        if (state.state &= ~kSync, !state.reading)
          n = howMuchToRead(nOrig, state);
      }
      let ret;
      if (n > 0)
        ret = fromList(n, state);
      else
        ret = null;
      if (ret === null)
        state.needReadable = state.length <= state.highWaterMark, n = 0;
      else if (state.length -= n, state.multiAwaitDrain)
        state.awaitDrainWriters.clear();
      else
        state.awaitDrainWriters = null;
      if (state.length === 0) {
        if (!state.ended)
          state.needReadable = true;
        if (nOrig !== n && state.ended)
          endReadable(this);
      }
      if (ret !== null && !state.errorEmitted && !state.closeEmitted)
        state.dataEmitted = true, this.emit("data", ret);
      return ret;
    };
    function onEofChunk(stream, state) {
      if (debug("onEofChunk"), state.ended)
        return;
      if (state.decoder) {
        let chunk = state.decoder.end();
        if (chunk && chunk.length)
          state.buffer.push(chunk), state.length += state.objectMode ? 1 : chunk.length;
      }
      if (state.ended = true, state.sync)
        emitReadable(stream);
      else
        state.needReadable = false, state.emittedReadable = true, emitReadable_(stream);
    }
    function emitReadable(stream) {
      let state = stream._readableState;
      if (debug("emitReadable", state.needReadable, state.emittedReadable), state.needReadable = false, !state.emittedReadable)
        debug("emitReadable", state.flowing), state.emittedReadable = true, process2.nextTick(emitReadable_, stream);
    }
    function emitReadable_(stream) {
      let state = stream._readableState;
      if (debug("emitReadable_", state.destroyed, state.length, state.ended), !state.destroyed && !state.errored && (state.length || state.ended))
        stream.emit("readable"), state.emittedReadable = false;
      state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark, flow(stream);
    }
    function maybeReadMore(stream, state) {
      if (!state.readingMore && state.constructed)
        state.readingMore = true, process2.nextTick(maybeReadMore_, stream, state);
    }
    function maybeReadMore_(stream, state) {
      while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
        let len2 = state.length;
        if (debug("maybeReadMore read 0"), stream.read(0), len2 === state.length)
          break;
      }
      state.readingMore = false;
    }
    Readable.prototype._read = function(n) {
      throw new ERR_METHOD_NOT_IMPLEMENTED("_read()");
    };
    Readable.prototype.pipe = function(dest, pipeOpts) {
      let src = this, state = this._readableState;
      if (state.pipes.length === 1) {
        if (!state.multiAwaitDrain)
          state.multiAwaitDrain = true, state.awaitDrainWriters = new SafeSet(state.awaitDrainWriters ? [state.awaitDrainWriters] : []);
      }
      state.pipes.push(dest), debug("pipe count=%d opts=%j", state.pipes.length, pipeOpts);
      let endFn = (!pipeOpts || pipeOpts.end !== false) && dest !== process2.stdout && dest !== process2.stderr ? onend : unpipe;
      if (state.endEmitted)
        process2.nextTick(endFn);
      else
        src.once("end", endFn);
      dest.on("unpipe", onunpipe);
      function onunpipe(readable, unpipeInfo) {
        if (debug("onunpipe"), readable === src) {
          if (unpipeInfo && unpipeInfo.hasUnpiped === false)
            unpipeInfo.hasUnpiped = true, cleanup();
        }
      }
      function onend() {
        debug("onend"), dest.end();
      }
      let ondrain, cleanedUp = false;
      function cleanup() {
        if (debug("cleanup"), dest.removeListener("close", onclose), dest.removeListener("finish", onfinish), ondrain)
          dest.removeListener("drain", ondrain);
        if (dest.removeListener("error", onerror), dest.removeListener("unpipe", onunpipe), src.removeListener("end", onend), src.removeListener("end", unpipe), src.removeListener("data", ondata), cleanedUp = true, ondrain && state.awaitDrainWriters && (!dest._writableState || dest._writableState.needDrain))
          ondrain();
      }
      function pause() {
        if (!cleanedUp) {
          if (state.pipes.length === 1 && state.pipes[0] === dest)
            debug("false write response, pause", 0), state.awaitDrainWriters = dest, state.multiAwaitDrain = false;
          else if (state.pipes.length > 1 && state.pipes.includes(dest))
            debug("false write response, pause", state.awaitDrainWriters.size), state.awaitDrainWriters.add(dest);
          src.pause();
        }
        if (!ondrain)
          ondrain = pipeOnDrain(src, dest), dest.on("drain", ondrain);
      }
      src.on("data", ondata);
      function ondata(chunk) {
        debug("ondata");
        let ret = dest.write(chunk);
        if (debug("dest.write", ret), ret === false)
          pause();
      }
      function onerror(er) {
        if (debug("onerror", er), unpipe(), dest.removeListener("error", onerror), dest.listenerCount("error") === 0) {
          let s = dest._writableState || dest._readableState;
          if (s && !s.errorEmitted)
            errorOrDestroy(dest, er);
          else
            dest.emit("error", er);
        }
      }
      prependListener(dest, "error", onerror);
      function onclose() {
        dest.removeListener("finish", onfinish), unpipe();
      }
      dest.once("close", onclose);
      function onfinish() {
        debug("onfinish"), dest.removeListener("close", onclose), unpipe();
      }
      dest.once("finish", onfinish);
      function unpipe() {
        debug("unpipe"), src.unpipe(dest);
      }
      if (dest.emit("pipe", src), dest.writableNeedDrain === true)
        pause();
      else if (!state.flowing)
        debug("pipe resume"), src.resume();
      return dest;
    };
    function pipeOnDrain(src, dest) {
      return function() {
        let state = src._readableState;
        if (state.awaitDrainWriters === dest)
          debug("pipeOnDrain", 1), state.awaitDrainWriters = null;
        else if (state.multiAwaitDrain)
          debug("pipeOnDrain", state.awaitDrainWriters.size), state.awaitDrainWriters.delete(dest);
        if ((!state.awaitDrainWriters || state.awaitDrainWriters.size === 0) && src.listenerCount("data"))
          src.resume();
      };
    }
    Readable.prototype.unpipe = function(dest) {
      let state = this._readableState, unpipeInfo = { hasUnpiped: false };
      if (state.pipes.length === 0)
        return this;
      if (!dest) {
        let dests = state.pipes;
        state.pipes = [], this.pause();
        for (let i2 = 0;i2 < dests.length; i2++)
          dests[i2].emit("unpipe", this, { hasUnpiped: false });
        return this;
      }
      let index = ArrayPrototypeIndexOf(state.pipes, dest);
      if (index === -1)
        return this;
      if (state.pipes.splice(index, 1), state.pipes.length === 0)
        this.pause();
      return dest.emit("unpipe", this, unpipeInfo), this;
    };
    Readable.prototype.on = function(ev, fn) {
      let res = Stream.prototype.on.call(this, ev, fn), state = this._readableState;
      if (ev === "data") {
        if (state.readableListening = this.listenerCount("readable") > 0, state.flowing !== false)
          this.resume();
      } else if (ev === "readable") {
        if (!state.endEmitted && !state.readableListening) {
          if (state.readableListening = state.needReadable = true, state.flowing = false, state.emittedReadable = false, debug("on readable", state.length, state.reading), state.length)
            emitReadable(this);
          else if (!state.reading)
            process2.nextTick(nReadingNextTick, this);
        }
      }
      return res;
    };
    Readable.prototype.addListener = Readable.prototype.on;
    Readable.prototype.removeListener = function(ev, fn) {
      let res = Stream.prototype.removeListener.call(this, ev, fn);
      if (ev === "readable")
        process2.nextTick(updateReadableListening, this);
      return res;
    };
    Readable.prototype.off = Readable.prototype.removeListener;
    Readable.prototype.removeAllListeners = function(ev) {
      let res = Stream.prototype.removeAllListeners.apply(this, arguments);
      if (ev === "readable" || ev === undefined)
        process2.nextTick(updateReadableListening, this);
      return res;
    };
    function updateReadableListening(self2) {
      let state = self2._readableState;
      if (state.readableListening = self2.listenerCount("readable") > 0, state.resumeScheduled && state[kPaused] === false)
        state.flowing = true;
      else if (self2.listenerCount("data") > 0)
        self2.resume();
      else if (!state.readableListening)
        state.flowing = null;
    }
    function nReadingNextTick(self2) {
      debug("readable nexttick read 0"), self2.read(0);
    }
    Readable.prototype.resume = function() {
      let state = this._readableState;
      if (!state.flowing)
        debug("resume"), state.flowing = !state.readableListening, resume(this, state);
      return state[kPaused] = false, this;
    };
    function resume(stream, state) {
      if (!state.resumeScheduled)
        state.resumeScheduled = true, process2.nextTick(resume_, stream, state);
    }
    function resume_(stream, state) {
      if (debug("resume", state.reading), !state.reading)
        stream.read(0);
      if (state.resumeScheduled = false, stream.emit("resume"), flow(stream), state.flowing && !state.reading)
        stream.read(0);
    }
    Readable.prototype.pause = function() {
      if (debug("call pause flowing=%j", this._readableState.flowing), this._readableState.flowing !== false)
        debug("pause"), this._readableState.flowing = false, this.emit("pause");
      return this._readableState[kPaused] = true, this;
    };
    function flow(stream) {
      let state = stream._readableState;
      debug("flow", state.flowing);
      while (state.flowing && stream.read() !== null)
        ;
    }
    Readable.prototype.wrap = function(stream) {
      let paused = false;
      stream.on("data", (chunk) => {
        if (!this.push(chunk) && stream.pause)
          paused = true, stream.pause();
      }), stream.on("end", () => {
        this.push(null);
      }), stream.on("error", (err) => {
        errorOrDestroy(this, err);
      }), stream.on("close", () => {
        this.destroy();
      }), stream.on("destroy", () => {
        this.destroy();
      }), this._read = () => {
        if (paused && stream.resume)
          paused = false, stream.resume();
      };
      let streamKeys = ObjectKeys(stream);
      for (let j = 1;j < streamKeys.length; j++) {
        let i2 = streamKeys[j];
        if (this[i2] === undefined && typeof stream[i2] === "function")
          this[i2] = stream[i2].bind(stream);
      }
      return this;
    };
    Readable.prototype[SymbolAsyncIterator] = function() {
      return streamToAsyncIterator(this);
    };
    Readable.prototype.iterator = function(options) {
      if (options !== undefined)
        validateObject(options, "options");
      return streamToAsyncIterator(this, options);
    };
    function streamToAsyncIterator(stream, options) {
      if (typeof stream.read !== "function")
        stream = Readable.wrap(stream, { objectMode: true });
      let iter = createAsyncIterator(stream, options);
      return iter.stream = stream, iter;
    }
    async function* createAsyncIterator(stream, options) {
      let callback = nop;
      function next(resolve) {
        if (this === stream)
          callback(), callback = nop;
        else
          callback = resolve;
      }
      stream.on("readable", next);
      let error, cleanup = eos(stream, { writable: false }, (err) => {
        error = err ? aggregateTwoErrors(error, err) : null, callback(), callback = nop;
      });
      try {
        while (true) {
          let chunk = stream.destroyed ? null : stream.read();
          if (chunk !== null)
            yield chunk;
          else if (error)
            throw error;
          else if (error === null)
            return;
          else
            await new Promise2(next);
        }
      } catch (err) {
        throw error = aggregateTwoErrors(error, err), error;
      } finally {
        if ((error || (options === null || options === undefined ? undefined : options.destroyOnReturn) !== false) && (error === undefined || stream._readableState.autoDestroy))
          destroyImpl.destroyer(stream, null);
        else
          stream.off("readable", next), cleanup();
      }
    }
    ObjectDefineProperties(Readable.prototype, { readable: { __proto__: null, get() {
      let r = this._readableState;
      return !!r && r.readable !== false && !r.destroyed && !r.errorEmitted && !r.endEmitted;
    }, set(val) {
      if (this._readableState)
        this._readableState.readable = !!val;
    } }, readableDidRead: { __proto__: null, enumerable: false, get: function() {
      return this._readableState.dataEmitted;
    } }, readableAborted: { __proto__: null, enumerable: false, get: function() {
      return !!(this._readableState.readable !== false && (this._readableState.destroyed || this._readableState.errored) && !this._readableState.endEmitted);
    } }, readableHighWaterMark: { __proto__: null, enumerable: false, get: function() {
      return this._readableState.highWaterMark;
    } }, readableBuffer: { __proto__: null, enumerable: false, get: function() {
      return this._readableState && this._readableState.buffer;
    } }, readableFlowing: { __proto__: null, enumerable: false, get: function() {
      return this._readableState.flowing;
    }, set: function(state) {
      if (this._readableState)
        this._readableState.flowing = state;
    } }, readableLength: { __proto__: null, enumerable: false, get() {
      return this._readableState.length;
    } }, readableObjectMode: { __proto__: null, enumerable: false, get() {
      return this._readableState ? this._readableState.objectMode : false;
    } }, readableEncoding: { __proto__: null, enumerable: false, get() {
      return this._readableState ? this._readableState.encoding : null;
    } }, errored: { __proto__: null, enumerable: false, get() {
      return this._readableState ? this._readableState.errored : null;
    } }, closed: { __proto__: null, get() {
      return this._readableState ? this._readableState.closed : false;
    } }, destroyed: { __proto__: null, enumerable: false, get() {
      return this._readableState ? this._readableState.destroyed : false;
    }, set(value) {
      if (!this._readableState)
        return;
      this._readableState.destroyed = value;
    } }, readableEnded: { __proto__: null, enumerable: false, get() {
      return this._readableState ? this._readableState.endEmitted : false;
    } } });
    ObjectDefineProperties(ReadableState.prototype, { pipesCount: { __proto__: null, get() {
      return this.pipes.length;
    } }, paused: { __proto__: null, get() {
      return this[kPaused] !== false;
    }, set(value) {
      this[kPaused] = !!value;
    } } });
    Readable._fromList = fromList;
    function fromList(n, state) {
      if (state.length === 0)
        return null;
      let ret;
      if (state.objectMode)
        ret = state.buffer.shift();
      else if (!n || n >= state.length) {
        if (state.decoder)
          ret = state.buffer.join("");
        else if (state.buffer.length === 1)
          ret = state.buffer.first();
        else
          ret = state.buffer.concat(state.length);
        state.buffer.clear();
      } else
        ret = state.buffer.consume(n, state.decoder);
      return ret;
    }
    function endReadable(stream) {
      let state = stream._readableState;
      if (debug("endReadable", state.endEmitted), !state.endEmitted)
        state.ended = true, process2.nextTick(endReadableNT, state, stream);
    }
    function endReadableNT(state, stream) {
      if (debug("endReadableNT", state.endEmitted, state.length), !state.errored && !state.closeEmitted && !state.endEmitted && state.length === 0) {
        if (state.endEmitted = true, stream.emit("end"), stream.writable && stream.allowHalfOpen === false)
          process2.nextTick(endWritableNT, stream);
        else if (state.autoDestroy) {
          let wState = stream._writableState;
          if (!wState || wState.autoDestroy && (wState.finished || wState.writable === false))
            stream.destroy();
        }
      }
    }
    function endWritableNT(stream) {
      if (stream.writable && !stream.writableEnded && !stream.destroyed)
        stream.end();
    }
    Readable.from = function(iterable, opts) {
      return from2(Readable, iterable, opts);
    };
    var webStreamsAdapters;
    function lazyWebStreams() {
      if (webStreamsAdapters === undefined)
        webStreamsAdapters = {};
      return webStreamsAdapters;
    }
    Readable.fromWeb = function(readableStream, options) {
      return lazyWebStreams().newStreamReadableFromReadableStream(readableStream, options);
    };
    Readable.toWeb = function(streamReadable, options) {
      return lazyWebStreams().newReadableStreamFromStreamReadable(streamReadable, options);
    };
    Readable.wrap = function(src, options) {
      var _ref, _src$readableObjectMo;
      return new Readable({ objectMode: (_ref = (_src$readableObjectMo = src.readableObjectMode) !== null && _src$readableObjectMo !== undefined ? _src$readableObjectMo : src.objectMode) !== null && _ref !== undefined ? _ref : true, ...options, destroy(err, callback) {
        destroyImpl.destroyer(src, err), callback(err);
      } }).wrap(src);
    };
  });
  var require_writable = __commonJS2((exports2, module2) => {
    var process2 = require_process(), { ArrayPrototypeSlice: ArrayPrototypeSlice2, Error: Error2, FunctionPrototypeSymbolHasInstance, ObjectDefineProperty, ObjectDefineProperties, ObjectSetPrototypeOf, StringPrototypeToLowerCase, Symbol: Symbol2, SymbolHasInstance } = require_primordials();
    module2.exports = Writable;
    Writable.WritableState = WritableState;
    var { EventEmitter: EE } = (init_events(), __toCommonJS(exports_events)), Stream = require_legacy().Stream, { Buffer: Buffer3 } = (init_buffer(), __toCommonJS(exports_buffer)), destroyImpl = require_destroy(), { addAbortSignal } = require_add_abort_signal(), { getHighWaterMark, getDefaultHighWaterMark } = require_state(), { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_METHOD_NOT_IMPLEMENTED, ERR_MULTIPLE_CALLBACK, ERR_STREAM_CANNOT_PIPE, ERR_STREAM_DESTROYED, ERR_STREAM_ALREADY_FINISHED, ERR_STREAM_NULL_VALUES, ERR_STREAM_WRITE_AFTER_END, ERR_UNKNOWN_ENCODING } = require_errors().codes, { errorOrDestroy } = destroyImpl;
    ObjectSetPrototypeOf(Writable.prototype, Stream.prototype);
    ObjectSetPrototypeOf(Writable, Stream);
    function nop() {}
    var kOnFinished = Symbol2("kOnFinished");
    function WritableState(options, stream, isDuplex) {
      if (typeof isDuplex !== "boolean")
        isDuplex = stream instanceof require_duplex();
      if (this.objectMode = !!(options && options.objectMode), isDuplex)
        this.objectMode = this.objectMode || !!(options && options.writableObjectMode);
      this.highWaterMark = options ? getHighWaterMark(this, options, "writableHighWaterMark", isDuplex) : getDefaultHighWaterMark(false), this.finalCalled = false, this.needDrain = false, this.ending = false, this.ended = false, this.finished = false, this.destroyed = false;
      let noDecode = !!(options && options.decodeStrings === false);
      this.decodeStrings = !noDecode, this.defaultEncoding = options && options.defaultEncoding || "utf8", this.length = 0, this.writing = false, this.corked = 0, this.sync = true, this.bufferProcessing = false, this.onwrite = onwrite.bind(undefined, stream), this.writecb = null, this.writelen = 0, this.afterWriteTickInfo = null, resetBuffer(this), this.pendingcb = 0, this.constructed = true, this.prefinished = false, this.errorEmitted = false, this.emitClose = !options || options.emitClose !== false, this.autoDestroy = !options || options.autoDestroy !== false, this.errored = null, this.closed = false, this.closeEmitted = false, this[kOnFinished] = [];
    }
    function resetBuffer(state) {
      state.buffered = [], state.bufferedIndex = 0, state.allBuffers = true, state.allNoop = true;
    }
    WritableState.prototype.getBuffer = function() {
      return ArrayPrototypeSlice2(this.buffered, this.bufferedIndex);
    };
    ObjectDefineProperty(WritableState.prototype, "bufferedRequestCount", { __proto__: null, get() {
      return this.buffered.length - this.bufferedIndex;
    } });
    function Writable(options) {
      let isDuplex = this instanceof require_duplex();
      if (!isDuplex && !FunctionPrototypeSymbolHasInstance(Writable, this))
        return new Writable(options);
      if (this._writableState = new WritableState(options, this, isDuplex), options) {
        if (typeof options.write === "function")
          this._write = options.write;
        if (typeof options.writev === "function")
          this._writev = options.writev;
        if (typeof options.destroy === "function")
          this._destroy = options.destroy;
        if (typeof options.final === "function")
          this._final = options.final;
        if (typeof options.construct === "function")
          this._construct = options.construct;
        if (options.signal)
          addAbortSignal(options.signal, this);
      }
      Stream.call(this, options), destroyImpl.construct(this, () => {
        let state = this._writableState;
        if (!state.writing)
          clearBuffer(this, state);
        finishMaybe(this, state);
      });
    }
    ObjectDefineProperty(Writable, SymbolHasInstance, { __proto__: null, value: function(object) {
      if (FunctionPrototypeSymbolHasInstance(this, object))
        return true;
      if (this !== Writable)
        return false;
      return object && object._writableState instanceof WritableState;
    } });
    Writable.prototype.pipe = function() {
      errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE);
    };
    function _write(stream, chunk, encoding, cb) {
      let state = stream._writableState;
      if (typeof encoding === "function")
        cb = encoding, encoding = state.defaultEncoding;
      else {
        if (!encoding)
          encoding = state.defaultEncoding;
        else if (encoding !== "buffer" && !Buffer3.isEncoding(encoding))
          throw new ERR_UNKNOWN_ENCODING(encoding);
        if (typeof cb !== "function")
          cb = nop;
      }
      if (chunk === null)
        throw new ERR_STREAM_NULL_VALUES;
      else if (!state.objectMode)
        if (typeof chunk === "string") {
          if (state.decodeStrings !== false)
            chunk = Buffer3.from(chunk, encoding), encoding = "buffer";
        } else if (chunk instanceof Buffer3)
          encoding = "buffer";
        else if (Stream._isUint8Array(chunk))
          chunk = Stream._uint8ArrayToBuffer(chunk), encoding = "buffer";
        else
          throw new ERR_INVALID_ARG_TYPE3("chunk", ["string", "Buffer", "Uint8Array"], chunk);
      let err;
      if (state.ending)
        err = new ERR_STREAM_WRITE_AFTER_END;
      else if (state.destroyed)
        err = new ERR_STREAM_DESTROYED("write");
      if (err)
        return process2.nextTick(cb, err), errorOrDestroy(stream, err, true), err;
      return state.pendingcb++, writeOrBuffer(stream, state, chunk, encoding, cb);
    }
    Writable.prototype.write = function(chunk, encoding, cb) {
      return _write(this, chunk, encoding, cb) === true;
    };
    Writable.prototype.cork = function() {
      this._writableState.corked++;
    };
    Writable.prototype.uncork = function() {
      let state = this._writableState;
      if (state.corked) {
        if (state.corked--, !state.writing)
          clearBuffer(this, state);
      }
    };
    Writable.prototype.setDefaultEncoding = function(encoding) {
      if (typeof encoding === "string")
        encoding = StringPrototypeToLowerCase(encoding);
      if (!Buffer3.isEncoding(encoding))
        throw new ERR_UNKNOWN_ENCODING(encoding);
      return this._writableState.defaultEncoding = encoding, this;
    };
    function writeOrBuffer(stream, state, chunk, encoding, callback) {
      let len2 = state.objectMode ? 1 : chunk.length;
      state.length += len2;
      let ret = state.length < state.highWaterMark;
      if (!ret)
        state.needDrain = true;
      if (state.writing || state.corked || state.errored || !state.constructed) {
        if (state.buffered.push({ chunk, encoding, callback }), state.allBuffers && encoding !== "buffer")
          state.allBuffers = false;
        if (state.allNoop && callback !== nop)
          state.allNoop = false;
      } else
        state.writelen = len2, state.writecb = callback, state.writing = true, state.sync = true, stream._write(chunk, encoding, state.onwrite), state.sync = false;
      return ret && !state.errored && !state.destroyed;
    }
    function doWrite(stream, state, writev, len2, chunk, encoding, cb) {
      if (state.writelen = len2, state.writecb = cb, state.writing = true, state.sync = true, state.destroyed)
        state.onwrite(new ERR_STREAM_DESTROYED("write"));
      else if (writev)
        stream._writev(chunk, state.onwrite);
      else
        stream._write(chunk, encoding, state.onwrite);
      state.sync = false;
    }
    function onwriteError(stream, state, er, cb) {
      --state.pendingcb, cb(er), errorBuffer(state), errorOrDestroy(stream, er);
    }
    function onwrite(stream, er) {
      let state = stream._writableState, sync = state.sync, cb = state.writecb;
      if (typeof cb !== "function") {
        errorOrDestroy(stream, new ERR_MULTIPLE_CALLBACK);
        return;
      }
      if (state.writing = false, state.writecb = null, state.length -= state.writelen, state.writelen = 0, er) {
        if (er.stack, !state.errored)
          state.errored = er;
        if (stream._readableState && !stream._readableState.errored)
          stream._readableState.errored = er;
        if (sync)
          process2.nextTick(onwriteError, stream, state, er, cb);
        else
          onwriteError(stream, state, er, cb);
      } else {
        if (state.buffered.length > state.bufferedIndex)
          clearBuffer(stream, state);
        if (sync)
          if (state.afterWriteTickInfo !== null && state.afterWriteTickInfo.cb === cb)
            state.afterWriteTickInfo.count++;
          else
            state.afterWriteTickInfo = { count: 1, cb, stream, state }, process2.nextTick(afterWriteTick, state.afterWriteTickInfo);
        else
          afterWrite(stream, state, 1, cb);
      }
    }
    function afterWriteTick({ stream, state, count, cb }) {
      return state.afterWriteTickInfo = null, afterWrite(stream, state, count, cb);
    }
    function afterWrite(stream, state, count, cb) {
      if (!state.ending && !stream.destroyed && state.length === 0 && state.needDrain)
        state.needDrain = false, stream.emit("drain");
      while (count-- > 0)
        state.pendingcb--, cb();
      if (state.destroyed)
        errorBuffer(state);
      finishMaybe(stream, state);
    }
    function errorBuffer(state) {
      if (state.writing)
        return;
      for (let n = state.bufferedIndex;n < state.buffered.length; ++n) {
        var _state$errored;
        let { chunk, callback } = state.buffered[n], len2 = state.objectMode ? 1 : chunk.length;
        state.length -= len2, callback((_state$errored = state.errored) !== null && _state$errored !== undefined ? _state$errored : new ERR_STREAM_DESTROYED("write"));
      }
      let onfinishCallbacks = state[kOnFinished].splice(0);
      for (let i2 = 0;i2 < onfinishCallbacks.length; i2++) {
        var _state$errored2;
        onfinishCallbacks[i2]((_state$errored2 = state.errored) !== null && _state$errored2 !== undefined ? _state$errored2 : new ERR_STREAM_DESTROYED("end"));
      }
      resetBuffer(state);
    }
    function clearBuffer(stream, state) {
      if (state.corked || state.bufferProcessing || state.destroyed || !state.constructed)
        return;
      let { buffered, bufferedIndex, objectMode } = state, bufferedLength = buffered.length - bufferedIndex;
      if (!bufferedLength)
        return;
      let i2 = bufferedIndex;
      if (state.bufferProcessing = true, bufferedLength > 1 && stream._writev) {
        state.pendingcb -= bufferedLength - 1;
        let callback = state.allNoop ? nop : (err) => {
          for (let n = i2;n < buffered.length; ++n)
            buffered[n].callback(err);
        }, chunks = state.allNoop && i2 === 0 ? buffered : ArrayPrototypeSlice2(buffered, i2);
        chunks.allBuffers = state.allBuffers, doWrite(stream, state, true, state.length, chunks, "", callback), resetBuffer(state);
      } else {
        do {
          let { chunk, encoding, callback } = buffered[i2];
          buffered[i2++] = null;
          let len2 = objectMode ? 1 : chunk.length;
          doWrite(stream, state, false, len2, chunk, encoding, callback);
        } while (i2 < buffered.length && !state.writing);
        if (i2 === buffered.length)
          resetBuffer(state);
        else if (i2 > 256)
          buffered.splice(0, i2), state.bufferedIndex = 0;
        else
          state.bufferedIndex = i2;
      }
      state.bufferProcessing = false;
    }
    Writable.prototype._write = function(chunk, encoding, cb) {
      if (this._writev)
        this._writev([{ chunk, encoding }], cb);
      else
        throw new ERR_METHOD_NOT_IMPLEMENTED("_write()");
    };
    Writable.prototype._writev = null;
    Writable.prototype.end = function(chunk, encoding, cb) {
      let state = this._writableState;
      if (typeof chunk === "function")
        cb = chunk, chunk = null, encoding = null;
      else if (typeof encoding === "function")
        cb = encoding, encoding = null;
      let err;
      if (chunk !== null && chunk !== undefined) {
        let ret = _write(this, chunk, encoding);
        if (ret instanceof Error2)
          err = ret;
      }
      if (state.corked)
        state.corked = 1, this.uncork();
      if (err)
        ;
      else if (!state.errored && !state.ending)
        state.ending = true, finishMaybe(this, state, true), state.ended = true;
      else if (state.finished)
        err = new ERR_STREAM_ALREADY_FINISHED("end");
      else if (state.destroyed)
        err = new ERR_STREAM_DESTROYED("end");
      if (typeof cb === "function")
        if (err || state.finished)
          process2.nextTick(cb, err);
        else
          state[kOnFinished].push(cb);
      return this;
    };
    function needFinish(state) {
      return state.ending && !state.destroyed && state.constructed && state.length === 0 && !state.errored && state.buffered.length === 0 && !state.finished && !state.writing && !state.errorEmitted && !state.closeEmitted;
    }
    function callFinal(stream, state) {
      let called = false;
      function onFinish(err) {
        if (called) {
          errorOrDestroy(stream, err !== null && err !== undefined ? err : ERR_MULTIPLE_CALLBACK());
          return;
        }
        if (called = true, state.pendingcb--, err) {
          let onfinishCallbacks = state[kOnFinished].splice(0);
          for (let i2 = 0;i2 < onfinishCallbacks.length; i2++)
            onfinishCallbacks[i2](err);
          errorOrDestroy(stream, err, state.sync);
        } else if (needFinish(state))
          state.prefinished = true, stream.emit("prefinish"), state.pendingcb++, process2.nextTick(finish, stream, state);
      }
      state.sync = true, state.pendingcb++;
      try {
        stream._final(onFinish);
      } catch (err) {
        onFinish(err);
      }
      state.sync = false;
    }
    function prefinish(stream, state) {
      if (!state.prefinished && !state.finalCalled)
        if (typeof stream._final === "function" && !state.destroyed)
          state.finalCalled = true, callFinal(stream, state);
        else
          state.prefinished = true, stream.emit("prefinish");
    }
    function finishMaybe(stream, state, sync) {
      if (needFinish(state)) {
        if (prefinish(stream, state), state.pendingcb === 0) {
          if (sync)
            state.pendingcb++, process2.nextTick((stream2, state2) => {
              if (needFinish(state2))
                finish(stream2, state2);
              else
                state2.pendingcb--;
            }, stream, state);
          else if (needFinish(state))
            state.pendingcb++, finish(stream, state);
        }
      }
    }
    function finish(stream, state) {
      state.pendingcb--, state.finished = true;
      let onfinishCallbacks = state[kOnFinished].splice(0);
      for (let i2 = 0;i2 < onfinishCallbacks.length; i2++)
        onfinishCallbacks[i2]();
      if (stream.emit("finish"), state.autoDestroy) {
        let rState = stream._readableState;
        if (!rState || rState.autoDestroy && (rState.endEmitted || rState.readable === false))
          stream.destroy();
      }
    }
    ObjectDefineProperties(Writable.prototype, { closed: { __proto__: null, get() {
      return this._writableState ? this._writableState.closed : false;
    } }, destroyed: { __proto__: null, get() {
      return this._writableState ? this._writableState.destroyed : false;
    }, set(value) {
      if (this._writableState)
        this._writableState.destroyed = value;
    } }, writable: { __proto__: null, get() {
      let w = this._writableState;
      return !!w && w.writable !== false && !w.destroyed && !w.errored && !w.ending && !w.ended;
    }, set(val) {
      if (this._writableState)
        this._writableState.writable = !!val;
    } }, writableFinished: { __proto__: null, get() {
      return this._writableState ? this._writableState.finished : false;
    } }, writableObjectMode: { __proto__: null, get() {
      return this._writableState ? this._writableState.objectMode : false;
    } }, writableBuffer: { __proto__: null, get() {
      return this._writableState && this._writableState.getBuffer();
    } }, writableEnded: { __proto__: null, get() {
      return this._writableState ? this._writableState.ending : false;
    } }, writableNeedDrain: { __proto__: null, get() {
      let wState = this._writableState;
      if (!wState)
        return false;
      return !wState.destroyed && !wState.ending && wState.needDrain;
    } }, writableHighWaterMark: { __proto__: null, get() {
      return this._writableState && this._writableState.highWaterMark;
    } }, writableCorked: { __proto__: null, get() {
      return this._writableState ? this._writableState.corked : 0;
    } }, writableLength: { __proto__: null, get() {
      return this._writableState && this._writableState.length;
    } }, errored: { __proto__: null, enumerable: false, get() {
      return this._writableState ? this._writableState.errored : null;
    } }, writableAborted: { __proto__: null, enumerable: false, get: function() {
      return !!(this._writableState.writable !== false && (this._writableState.destroyed || this._writableState.errored) && !this._writableState.finished);
    } } });
    var destroy = destroyImpl.destroy;
    Writable.prototype.destroy = function(err, cb) {
      let state = this._writableState;
      if (!state.destroyed && (state.bufferedIndex < state.buffered.length || state[kOnFinished].length))
        process2.nextTick(errorBuffer, state);
      return destroy.call(this, err, cb), this;
    };
    Writable.prototype._undestroy = destroyImpl.undestroy;
    Writable.prototype._destroy = function(err, cb) {
      cb(err);
    };
    Writable.prototype[EE.captureRejectionSymbol] = function(err) {
      this.destroy(err);
    };
    var webStreamsAdapters;
    function lazyWebStreams() {
      if (webStreamsAdapters === undefined)
        webStreamsAdapters = {};
      return webStreamsAdapters;
    }
    Writable.fromWeb = function(writableStream, options) {
      return lazyWebStreams().newStreamWritableFromWritableStream(writableStream, options);
    };
    Writable.toWeb = function(streamWritable) {
      return lazyWebStreams().newWritableStreamFromStreamWritable(streamWritable);
    };
  });
  var require_duplexify = __commonJS2((exports2, module2) => {
    var process2 = require_process(), bufferModule = (init_buffer(), __toCommonJS(exports_buffer)), { isReadable, isWritable, isIterable, isNodeStream, isReadableNodeStream, isWritableNodeStream, isDuplexNodeStream, isReadableStream, isWritableStream } = require_utils(), eos = require_end_of_stream(), { AbortError: AbortError2, codes: { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_INVALID_RETURN_VALUE } } = require_errors(), { destroyer } = require_destroy(), Duplex = require_duplex(), Readable = require_readable(), Writable = require_writable(), { createDeferredPromise } = require_util(), from2 = require_from(), Blob3 = globalThis.Blob || bufferModule.Blob, isBlob = typeof Blob3 < "u" ? function(b) {
      return b instanceof Blob3;
    } : function(b) {
      return false;
    }, AbortController = globalThis.AbortController || require_abort_controller().AbortController, { FunctionPrototypeCall } = require_primordials();

    class Duplexify extends Duplex {
      constructor(options) {
        super(options);
        if ((options === null || options === undefined ? undefined : options.readable) === false)
          this._readableState.readable = false, this._readableState.ended = true, this._readableState.endEmitted = true;
        if ((options === null || options === undefined ? undefined : options.writable) === false)
          this._writableState.writable = false, this._writableState.ending = true, this._writableState.ended = true, this._writableState.finished = true;
      }
    }
    module2.exports = function duplexify(body, name) {
      if (isDuplexNodeStream(body))
        return body;
      if (isReadableNodeStream(body))
        return _duplexify({ readable: body });
      if (isWritableNodeStream(body))
        return _duplexify({ writable: body });
      if (isNodeStream(body))
        return _duplexify({ writable: false, readable: false });
      if (isReadableStream(body))
        return _duplexify({ readable: Readable.fromWeb(body) });
      if (isWritableStream(body))
        return _duplexify({ writable: Writable.fromWeb(body) });
      if (typeof body === "function") {
        let { value, write: write2, final, destroy } = fromAsyncGen(body);
        if (isIterable(value))
          return from2(Duplexify, value, { objectMode: true, write: write2, final, destroy });
        let then2 = value === null || value === undefined ? undefined : value.then;
        if (typeof then2 === "function") {
          let d, promise = FunctionPrototypeCall(then2, value, (val) => {
            if (val != null)
              throw new ERR_INVALID_RETURN_VALUE("nully", "body", val);
          }, (err) => {
            destroyer(d, err);
          });
          return d = new Duplexify({ objectMode: true, readable: false, write: write2, final(cb) {
            final(async () => {
              try {
                await promise, process2.nextTick(cb, null);
              } catch (err) {
                process2.nextTick(cb, err);
              }
            });
          }, destroy });
        }
        throw new ERR_INVALID_RETURN_VALUE("Iterable, AsyncIterable or AsyncFunction", name, value);
      }
      if (isBlob(body))
        return duplexify(body.arrayBuffer());
      if (isIterable(body))
        return from2(Duplexify, body, { objectMode: true, writable: false });
      if (isReadableStream(body === null || body === undefined ? undefined : body.readable) && isWritableStream(body === null || body === undefined ? undefined : body.writable))
        return Duplexify.fromWeb(body);
      if (typeof (body === null || body === undefined ? undefined : body.writable) === "object" || typeof (body === null || body === undefined ? undefined : body.readable) === "object") {
        let readable = body !== null && body !== undefined && body.readable ? isReadableNodeStream(body === null || body === undefined ? undefined : body.readable) ? body === null || body === undefined ? undefined : body.readable : duplexify(body.readable) : undefined, writable = body !== null && body !== undefined && body.writable ? isWritableNodeStream(body === null || body === undefined ? undefined : body.writable) ? body === null || body === undefined ? undefined : body.writable : duplexify(body.writable) : undefined;
        return _duplexify({ readable, writable });
      }
      let then = body === null || body === undefined ? undefined : body.then;
      if (typeof then === "function") {
        let d;
        return FunctionPrototypeCall(then, body, (val) => {
          if (val != null)
            d.push(val);
          d.push(null);
        }, (err) => {
          destroyer(d, err);
        }), d = new Duplexify({ objectMode: true, writable: false, read() {} });
      }
      throw new ERR_INVALID_ARG_TYPE3(name, ["Blob", "ReadableStream", "WritableStream", "Stream", "Iterable", "AsyncIterable", "Function", "{ readable, writable } pair", "Promise"], body);
    };
    function fromAsyncGen(fn) {
      let { promise, resolve } = createDeferredPromise(), ac = new AbortController, signal = ac.signal;
      return { value: fn(async function* () {
        while (true) {
          let _promise = promise;
          promise = null;
          let { chunk, done, cb } = await _promise;
          if (process2.nextTick(cb), done)
            return;
          if (signal.aborted)
            throw new AbortError2(undefined, { cause: signal.reason });
          ({ promise, resolve } = createDeferredPromise()), yield chunk;
        }
      }(), { signal }), write(chunk, encoding, cb) {
        let _resolve = resolve;
        resolve = null, _resolve({ chunk, done: false, cb });
      }, final(cb) {
        let _resolve = resolve;
        resolve = null, _resolve({ done: true, cb });
      }, destroy(err, cb) {
        ac.abort(), cb(err);
      } };
    }
    function _duplexify(pair) {
      let r = pair.readable && typeof pair.readable.read !== "function" ? Readable.wrap(pair.readable) : pair.readable, w = pair.writable, readable = !!isReadable(r), writable = !!isWritable(w), ondrain, onfinish, onreadable, onclose, d;
      function onfinished(err) {
        let cb = onclose;
        if (onclose = null, cb)
          cb(err);
        else if (err)
          d.destroy(err);
      }
      if (d = new Duplexify({ readableObjectMode: !!(r !== null && r !== undefined && r.readableObjectMode), writableObjectMode: !!(w !== null && w !== undefined && w.writableObjectMode), readable, writable }), writable)
        eos(w, (err) => {
          if (writable = false, err)
            destroyer(r, err);
          onfinished(err);
        }), d._write = function(chunk, encoding, callback) {
          if (w.write(chunk, encoding))
            callback();
          else
            ondrain = callback;
        }, d._final = function(callback) {
          w.end(), onfinish = callback;
        }, w.on("drain", function() {
          if (ondrain) {
            let cb = ondrain;
            ondrain = null, cb();
          }
        }), w.on("finish", function() {
          if (onfinish) {
            let cb = onfinish;
            onfinish = null, cb();
          }
        });
      if (readable)
        eos(r, (err) => {
          if (readable = false, err)
            destroyer(r, err);
          onfinished(err);
        }), r.on("readable", function() {
          if (onreadable) {
            let cb = onreadable;
            onreadable = null, cb();
          }
        }), r.on("end", function() {
          d.push(null);
        }), d._read = function() {
          while (true) {
            let buf = r.read();
            if (buf === null) {
              onreadable = d._read;
              return;
            }
            if (!d.push(buf))
              return;
          }
        };
      return d._destroy = function(err, callback) {
        if (!err && onclose !== null)
          err = new AbortError2;
        if (onreadable = null, ondrain = null, onfinish = null, onclose === null)
          callback(err);
        else
          onclose = callback, destroyer(w, err), destroyer(r, err);
      }, d;
    }
  });
  var require_duplex = __commonJS2((exports2, module2) => {
    var { ObjectDefineProperties, ObjectGetOwnPropertyDescriptor, ObjectKeys, ObjectSetPrototypeOf } = require_primordials();
    module2.exports = Duplex;
    var Readable = require_readable(), Writable = require_writable();
    ObjectSetPrototypeOf(Duplex.prototype, Readable.prototype);
    ObjectSetPrototypeOf(Duplex, Readable);
    {
      let keys = ObjectKeys(Writable.prototype);
      for (let i2 = 0;i2 < keys.length; i2++) {
        let method = keys[i2];
        if (!Duplex.prototype[method])
          Duplex.prototype[method] = Writable.prototype[method];
      }
    }
    function Duplex(options) {
      if (!(this instanceof Duplex))
        return new Duplex(options);
      if (Readable.call(this, options), Writable.call(this, options), options) {
        if (this.allowHalfOpen = options.allowHalfOpen !== false, options.readable === false)
          this._readableState.readable = false, this._readableState.ended = true, this._readableState.endEmitted = true;
        if (options.writable === false)
          this._writableState.writable = false, this._writableState.ending = true, this._writableState.ended = true, this._writableState.finished = true;
      } else
        this.allowHalfOpen = true;
    }
    ObjectDefineProperties(Duplex.prototype, { writable: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writable") }, writableHighWaterMark: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableHighWaterMark") }, writableObjectMode: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableObjectMode") }, writableBuffer: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableBuffer") }, writableLength: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableLength") }, writableFinished: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableFinished") }, writableCorked: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableCorked") }, writableEnded: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableEnded") }, writableNeedDrain: { __proto__: null, ...ObjectGetOwnPropertyDescriptor(Writable.prototype, "writableNeedDrain") }, destroyed: { __proto__: null, get() {
      if (this._readableState === undefined || this._writableState === undefined)
        return false;
      return this._readableState.destroyed && this._writableState.destroyed;
    }, set(value) {
      if (this._readableState && this._writableState)
        this._readableState.destroyed = value, this._writableState.destroyed = value;
    } } });
    var webStreamsAdapters;
    function lazyWebStreams() {
      if (webStreamsAdapters === undefined)
        webStreamsAdapters = {};
      return webStreamsAdapters;
    }
    Duplex.fromWeb = function(pair, options) {
      return lazyWebStreams().newStreamDuplexFromReadableWritablePair(pair, options);
    };
    Duplex.toWeb = function(duplex) {
      return lazyWebStreams().newReadableWritablePairFromDuplex(duplex);
    };
    var duplexify;
    Duplex.from = function(body) {
      if (!duplexify)
        duplexify = require_duplexify();
      return duplexify(body, "body");
    };
  });
  var require_transform = __commonJS2((exports2, module2) => {
    var { ObjectSetPrototypeOf, Symbol: Symbol2 } = require_primordials();
    module2.exports = Transform;
    var { ERR_METHOD_NOT_IMPLEMENTED } = require_errors().codes, Duplex = require_duplex(), { getHighWaterMark } = require_state();
    ObjectSetPrototypeOf(Transform.prototype, Duplex.prototype);
    ObjectSetPrototypeOf(Transform, Duplex);
    var kCallback = Symbol2("kCallback");
    function Transform(options) {
      if (!(this instanceof Transform))
        return new Transform(options);
      let readableHighWaterMark = options ? getHighWaterMark(this, options, "readableHighWaterMark", true) : null;
      if (readableHighWaterMark === 0)
        options = { ...options, highWaterMark: null, readableHighWaterMark, writableHighWaterMark: options.writableHighWaterMark || 0 };
      if (Duplex.call(this, options), this._readableState.sync = false, this[kCallback] = null, options) {
        if (typeof options.transform === "function")
          this._transform = options.transform;
        if (typeof options.flush === "function")
          this._flush = options.flush;
      }
      this.on("prefinish", prefinish);
    }
    function final(cb) {
      if (typeof this._flush === "function" && !this.destroyed)
        this._flush((er, data) => {
          if (er) {
            if (cb)
              cb(er);
            else
              this.destroy(er);
            return;
          }
          if (data != null)
            this.push(data);
          if (this.push(null), cb)
            cb();
        });
      else if (this.push(null), cb)
        cb();
    }
    function prefinish() {
      if (this._final !== final)
        final.call(this);
    }
    Transform.prototype._final = final;
    Transform.prototype._transform = function(chunk, encoding, callback) {
      throw new ERR_METHOD_NOT_IMPLEMENTED("_transform()");
    };
    Transform.prototype._write = function(chunk, encoding, callback) {
      let rState = this._readableState, wState = this._writableState, length = rState.length;
      this._transform(chunk, encoding, (err, val) => {
        if (err) {
          callback(err);
          return;
        }
        if (val != null)
          this.push(val);
        if (wState.ended || length === rState.length || rState.length < rState.highWaterMark)
          callback();
        else
          this[kCallback] = callback;
      });
    };
    Transform.prototype._read = function() {
      if (this[kCallback]) {
        let callback = this[kCallback];
        this[kCallback] = null, callback();
      }
    };
  });
  var require_passthrough = __commonJS2((exports2, module2) => {
    var { ObjectSetPrototypeOf } = require_primordials();
    module2.exports = PassThrough;
    var Transform = require_transform();
    ObjectSetPrototypeOf(PassThrough.prototype, Transform.prototype);
    ObjectSetPrototypeOf(PassThrough, Transform);
    function PassThrough(options) {
      if (!(this instanceof PassThrough))
        return new PassThrough(options);
      Transform.call(this, options);
    }
    PassThrough.prototype._transform = function(chunk, encoding, cb) {
      cb(null, chunk);
    };
  });
  var require_pipeline = __commonJS2((exports2, module2) => {
    var process2 = require_process(), { ArrayIsArray, Promise: Promise2, SymbolAsyncIterator, SymbolDispose } = require_primordials(), eos = require_end_of_stream(), { once } = require_util(), destroyImpl = require_destroy(), Duplex = require_duplex(), { aggregateTwoErrors, codes: { ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_INVALID_RETURN_VALUE, ERR_MISSING_ARGS, ERR_STREAM_DESTROYED, ERR_STREAM_PREMATURE_CLOSE }, AbortError: AbortError2 } = require_errors(), { validateFunction, validateAbortSignal: validateAbortSignal2 } = require_validators(), { isIterable, isReadable, isReadableNodeStream, isNodeStream, isTransformStream, isWebStream, isReadableStream, isReadableFinished } = require_utils(), AbortController = globalThis.AbortController || require_abort_controller().AbortController, PassThrough, Readable, addAbortListener2;
    function destroyer(stream, reading, writing) {
      let finished = false;
      stream.on("close", () => {
        finished = true;
      });
      let cleanup = eos(stream, { readable: reading, writable: writing }, (err) => {
        finished = !err;
      });
      return { destroy: (err) => {
        if (finished)
          return;
        finished = true, destroyImpl.destroyer(stream, err || new ERR_STREAM_DESTROYED("pipe"));
      }, cleanup };
    }
    function popCallback(streams) {
      return validateFunction(streams[streams.length - 1], "streams[stream.length - 1]"), streams.pop();
    }
    function makeAsyncIterable(val) {
      if (isIterable(val))
        return val;
      else if (isReadableNodeStream(val))
        return fromReadable(val);
      throw new ERR_INVALID_ARG_TYPE3("val", ["Readable", "Iterable", "AsyncIterable"], val);
    }
    async function* fromReadable(val) {
      if (!Readable)
        Readable = require_readable();
      yield* Readable.prototype[SymbolAsyncIterator].call(val);
    }
    async function pumpToNode(iterable, writable, finish, { end }) {
      let error, onresolve = null, resume = (err) => {
        if (err)
          error = err;
        if (onresolve) {
          let callback = onresolve;
          onresolve = null, callback();
        }
      }, wait = () => new Promise2((resolve, reject) => {
        if (error)
          reject(error);
        else
          onresolve = () => {
            if (error)
              reject(error);
            else
              resolve();
          };
      });
      writable.on("drain", resume);
      let cleanup = eos(writable, { readable: false }, resume);
      try {
        if (writable.writableNeedDrain)
          await wait();
        for await (let chunk of iterable)
          if (!writable.write(chunk))
            await wait();
        if (end)
          writable.end(), await wait();
        finish();
      } catch (err) {
        finish(error !== err ? aggregateTwoErrors(error, err) : err);
      } finally {
        cleanup(), writable.off("drain", resume);
      }
    }
    async function pumpToWeb(readable, writable, finish, { end }) {
      if (isTransformStream(writable))
        writable = writable.writable;
      let writer = writable.getWriter();
      try {
        for await (let chunk of readable)
          await writer.ready, writer.write(chunk).catch(() => {});
        if (await writer.ready, end)
          await writer.close();
        finish();
      } catch (err) {
        try {
          await writer.abort(err), finish(err);
        } catch (err2) {
          finish(err2);
        }
      }
    }
    function pipeline(...streams) {
      return pipelineImpl(streams, once(popCallback(streams)));
    }
    function pipelineImpl(streams, callback, opts) {
      if (streams.length === 1 && ArrayIsArray(streams[0]))
        streams = streams[0];
      if (streams.length < 2)
        throw new ERR_MISSING_ARGS("streams");
      let ac = new AbortController, signal = ac.signal, outerSignal = opts === null || opts === undefined ? undefined : opts.signal, lastStreamCleanup = [];
      validateAbortSignal2(outerSignal, "options.signal");
      function abort() {
        finishImpl(new AbortError2);
      }
      addAbortListener2 = addAbortListener2 || require_util().addAbortListener;
      let disposable;
      if (outerSignal)
        disposable = addAbortListener2(outerSignal, abort);
      let error, value, destroys = [], finishCount = 0;
      function finish(err) {
        finishImpl(err, --finishCount === 0);
      }
      function finishImpl(err, final) {
        var _disposable;
        if (err && (!error || error.code === "ERR_STREAM_PREMATURE_CLOSE"))
          error = err;
        if (!error && !final)
          return;
        while (destroys.length)
          destroys.shift()(error);
        if ((_disposable = disposable) === null || _disposable === undefined || _disposable[SymbolDispose](), ac.abort(), final) {
          if (!error)
            lastStreamCleanup.forEach((fn) => fn());
          process2.nextTick(callback, error, value);
        }
      }
      let ret;
      for (let i2 = 0;i2 < streams.length; i2++) {
        let stream = streams[i2], reading = i2 < streams.length - 1, writing = i2 > 0, end = reading || (opts === null || opts === undefined ? undefined : opts.end) !== false, isLastStream = i2 === streams.length - 1;
        if (isNodeStream(stream)) {
          let onError2 = function(err) {
            if (err && err.name !== "AbortError" && err.code !== "ERR_STREAM_PREMATURE_CLOSE")
              finish(err);
          };
          var onError = onError2;
          if (end) {
            let { destroy, cleanup } = destroyer(stream, reading, writing);
            if (destroys.push(destroy), isReadable(stream) && isLastStream)
              lastStreamCleanup.push(cleanup);
          }
          if (stream.on("error", onError2), isReadable(stream) && isLastStream)
            lastStreamCleanup.push(() => {
              stream.removeListener("error", onError2);
            });
        }
        if (i2 === 0)
          if (typeof stream === "function") {
            if (ret = stream({ signal }), !isIterable(ret))
              throw new ERR_INVALID_RETURN_VALUE("Iterable, AsyncIterable or Stream", "source", ret);
          } else if (isIterable(stream) || isReadableNodeStream(stream) || isTransformStream(stream))
            ret = stream;
          else
            ret = Duplex.from(stream);
        else if (typeof stream === "function") {
          if (isTransformStream(ret)) {
            var _ret;
            ret = makeAsyncIterable((_ret = ret) === null || _ret === undefined ? undefined : _ret.readable);
          } else
            ret = makeAsyncIterable(ret);
          if (ret = stream(ret, { signal }), reading) {
            if (!isIterable(ret, true))
              throw new ERR_INVALID_RETURN_VALUE("AsyncIterable", `transform[${i2 - 1}]`, ret);
          } else {
            var _ret2;
            if (!PassThrough)
              PassThrough = require_passthrough();
            let pt = new PassThrough({ objectMode: true }), then = (_ret2 = ret) === null || _ret2 === undefined ? undefined : _ret2.then;
            if (typeof then === "function")
              finishCount++, then.call(ret, (val) => {
                if (value = val, val != null)
                  pt.write(val);
                if (end)
                  pt.end();
                process2.nextTick(finish);
              }, (err) => {
                pt.destroy(err), process2.nextTick(finish, err);
              });
            else if (isIterable(ret, true))
              finishCount++, pumpToNode(ret, pt, finish, { end });
            else if (isReadableStream(ret) || isTransformStream(ret)) {
              let toRead = ret.readable || ret;
              finishCount++, pumpToNode(toRead, pt, finish, { end });
            } else
              throw new ERR_INVALID_RETURN_VALUE("AsyncIterable or Promise", "destination", ret);
            ret = pt;
            let { destroy, cleanup } = destroyer(ret, false, true);
            if (destroys.push(destroy), isLastStream)
              lastStreamCleanup.push(cleanup);
          }
        } else if (isNodeStream(stream)) {
          if (isReadableNodeStream(ret)) {
            finishCount += 2;
            let cleanup = pipe(ret, stream, finish, { end });
            if (isReadable(stream) && isLastStream)
              lastStreamCleanup.push(cleanup);
          } else if (isTransformStream(ret) || isReadableStream(ret)) {
            let toRead = ret.readable || ret;
            finishCount++, pumpToNode(toRead, stream, finish, { end });
          } else if (isIterable(ret))
            finishCount++, pumpToNode(ret, stream, finish, { end });
          else
            throw new ERR_INVALID_ARG_TYPE3("val", ["Readable", "Iterable", "AsyncIterable", "ReadableStream", "TransformStream"], ret);
          ret = stream;
        } else if (isWebStream(stream)) {
          if (isReadableNodeStream(ret))
            finishCount++, pumpToWeb(makeAsyncIterable(ret), stream, finish, { end });
          else if (isReadableStream(ret) || isIterable(ret))
            finishCount++, pumpToWeb(ret, stream, finish, { end });
          else if (isTransformStream(ret))
            finishCount++, pumpToWeb(ret.readable, stream, finish, { end });
          else
            throw new ERR_INVALID_ARG_TYPE3("val", ["Readable", "Iterable", "AsyncIterable", "ReadableStream", "TransformStream"], ret);
          ret = stream;
        } else
          ret = Duplex.from(stream);
      }
      if (signal !== null && signal !== undefined && signal.aborted || outerSignal !== null && outerSignal !== undefined && outerSignal.aborted)
        process2.nextTick(abort);
      return ret;
    }
    function pipe(src, dst, finish, { end }) {
      let ended = false;
      if (dst.on("close", () => {
        if (!ended)
          finish(new ERR_STREAM_PREMATURE_CLOSE);
      }), src.pipe(dst, { end: false }), end) {
        let endFn2 = function() {
          ended = true, dst.end();
        };
        var endFn = endFn2;
        if (isReadableFinished(src))
          process2.nextTick(endFn2);
        else
          src.once("end", endFn2);
      } else
        finish();
      return eos(src, { readable: true, writable: false }, (err) => {
        let rState = src._readableState;
        if (err && err.code === "ERR_STREAM_PREMATURE_CLOSE" && rState && rState.ended && !rState.errored && !rState.errorEmitted)
          src.once("end", finish).once("error", finish);
        else
          finish(err);
      }), eos(dst, { readable: false, writable: true }, finish);
    }
    module2.exports = { pipelineImpl, pipeline };
  });
  var require_compose = __commonJS2((exports2, module2) => {
    var { pipeline } = require_pipeline(), Duplex = require_duplex(), { destroyer } = require_destroy(), { isNodeStream, isReadable, isWritable, isWebStream, isTransformStream, isWritableStream, isReadableStream } = require_utils(), { AbortError: AbortError2, codes: { ERR_INVALID_ARG_VALUE, ERR_MISSING_ARGS } } = require_errors(), eos = require_end_of_stream();
    module2.exports = function(...streams) {
      if (streams.length === 0)
        throw new ERR_MISSING_ARGS("streams");
      if (streams.length === 1)
        return Duplex.from(streams[0]);
      let orgStreams = [...streams];
      if (typeof streams[0] === "function")
        streams[0] = Duplex.from(streams[0]);
      if (typeof streams[streams.length - 1] === "function") {
        let idx = streams.length - 1;
        streams[idx] = Duplex.from(streams[idx]);
      }
      for (let n = 0;n < streams.length; ++n) {
        if (!isNodeStream(streams[n]) && !isWebStream(streams[n]))
          continue;
        if (n < streams.length - 1 && !(isReadable(streams[n]) || isReadableStream(streams[n]) || isTransformStream(streams[n])))
          throw new ERR_INVALID_ARG_VALUE(`streams[${n}]`, orgStreams[n], "must be readable");
        if (n > 0 && !(isWritable(streams[n]) || isWritableStream(streams[n]) || isTransformStream(streams[n])))
          throw new ERR_INVALID_ARG_VALUE(`streams[${n}]`, orgStreams[n], "must be writable");
      }
      let ondrain, onfinish, onreadable, onclose, d;
      function onfinished(err) {
        let cb = onclose;
        if (onclose = null, cb)
          cb(err);
        else if (err)
          d.destroy(err);
        else if (!readable && !writable)
          d.destroy();
      }
      let head = streams[0], tail = pipeline(streams, onfinished), writable = !!(isWritable(head) || isWritableStream(head) || isTransformStream(head)), readable = !!(isReadable(tail) || isReadableStream(tail) || isTransformStream(tail));
      if (d = new Duplex({ writableObjectMode: !!(head !== null && head !== undefined && head.writableObjectMode), readableObjectMode: !!(tail !== null && tail !== undefined && tail.readableObjectMode), writable, readable }), writable) {
        if (isNodeStream(head))
          d._write = function(chunk, encoding, callback) {
            if (head.write(chunk, encoding))
              callback();
            else
              ondrain = callback;
          }, d._final = function(callback) {
            head.end(), onfinish = callback;
          }, head.on("drain", function() {
            if (ondrain) {
              let cb = ondrain;
              ondrain = null, cb();
            }
          });
        else if (isWebStream(head)) {
          let writer = (isTransformStream(head) ? head.writable : head).getWriter();
          d._write = async function(chunk, encoding, callback) {
            try {
              await writer.ready, writer.write(chunk).catch(() => {}), callback();
            } catch (err) {
              callback(err);
            }
          }, d._final = async function(callback) {
            try {
              await writer.ready, writer.close().catch(() => {}), onfinish = callback;
            } catch (err) {
              callback(err);
            }
          };
        }
        let toRead = isTransformStream(tail) ? tail.readable : tail;
        eos(toRead, () => {
          if (onfinish) {
            let cb = onfinish;
            onfinish = null, cb();
          }
        });
      }
      if (readable) {
        if (isNodeStream(tail))
          tail.on("readable", function() {
            if (onreadable) {
              let cb = onreadable;
              onreadable = null, cb();
            }
          }), tail.on("end", function() {
            d.push(null);
          }), d._read = function() {
            while (true) {
              let buf = tail.read();
              if (buf === null) {
                onreadable = d._read;
                return;
              }
              if (!d.push(buf))
                return;
            }
          };
        else if (isWebStream(tail)) {
          let reader = (isTransformStream(tail) ? tail.readable : tail).getReader();
          d._read = async function() {
            while (true)
              try {
                let { value, done } = await reader.read();
                if (!d.push(value))
                  return;
                if (done) {
                  d.push(null);
                  return;
                }
              } catch {
                return;
              }
          };
        }
      }
      return d._destroy = function(err, callback) {
        if (!err && onclose !== null)
          err = new AbortError2;
        if (onreadable = null, ondrain = null, onfinish = null, onclose === null)
          callback(err);
        else if (onclose = callback, isNodeStream(tail))
          destroyer(tail, err);
      }, d;
    };
  });
  var require_operators = __commonJS2((exports2, module2) => {
    var AbortController = globalThis.AbortController || require_abort_controller().AbortController, { codes: { ERR_INVALID_ARG_VALUE, ERR_INVALID_ARG_TYPE: ERR_INVALID_ARG_TYPE3, ERR_MISSING_ARGS, ERR_OUT_OF_RANGE: ERR_OUT_OF_RANGE3 }, AbortError: AbortError2 } = require_errors(), { validateAbortSignal: validateAbortSignal2, validateInteger, validateObject } = require_validators(), kWeakHandler = require_primordials().Symbol("kWeak"), kResistStopPropagation = require_primordials().Symbol("kResistStopPropagation"), { finished } = require_end_of_stream(), staticCompose = require_compose(), { addAbortSignalNoValidate } = require_add_abort_signal(), { isWritable, isNodeStream } = require_utils(), { deprecate } = require_util(), { ArrayPrototypePush, Boolean: Boolean2, MathFloor, Number: Number2, NumberIsNaN, Promise: Promise2, PromiseReject, PromiseResolve, PromisePrototypeThen, Symbol: Symbol2 } = require_primordials(), kEmpty = Symbol2("kEmpty"), kEof = Symbol2("kEof");
    function compose(stream, options) {
      if (options != null)
        validateObject(options, "options");
      if ((options === null || options === undefined ? undefined : options.signal) != null)
        validateAbortSignal2(options.signal, "options.signal");
      if (isNodeStream(stream) && !isWritable(stream))
        throw new ERR_INVALID_ARG_VALUE("stream", stream, "must be writable");
      let composedStream = staticCompose(this, stream);
      if (options !== null && options !== undefined && options.signal)
        addAbortSignalNoValidate(options.signal, composedStream);
      return composedStream;
    }
    function map(fn, options) {
      if (typeof fn !== "function")
        throw new ERR_INVALID_ARG_TYPE3("fn", ["Function", "AsyncFunction"], fn);
      if (options != null)
        validateObject(options, "options");
      if ((options === null || options === undefined ? undefined : options.signal) != null)
        validateAbortSignal2(options.signal, "options.signal");
      let concurrency = 1;
      if ((options === null || options === undefined ? undefined : options.concurrency) != null)
        concurrency = MathFloor(options.concurrency);
      let highWaterMark = concurrency - 1;
      if ((options === null || options === undefined ? undefined : options.highWaterMark) != null)
        highWaterMark = MathFloor(options.highWaterMark);
      return validateInteger(concurrency, "options.concurrency", 1), validateInteger(highWaterMark, "options.highWaterMark", 0), highWaterMark += concurrency, async function* () {
        let signal = require_util().AbortSignalAny([options === null || options === undefined ? undefined : options.signal].filter(Boolean2)), stream = this, queue = [], signalOpt = { signal }, next, resume, done = false, cnt = 0;
        function onCatch() {
          done = true, afterItemProcessed();
        }
        function afterItemProcessed() {
          cnt -= 1, maybeResume();
        }
        function maybeResume() {
          if (resume && !done && cnt < concurrency && queue.length < highWaterMark)
            resume(), resume = null;
        }
        async function pump() {
          try {
            for await (let val of stream) {
              if (done)
                return;
              if (signal.aborted)
                throw new AbortError2;
              try {
                if (val = fn(val, signalOpt), val === kEmpty)
                  continue;
                val = PromiseResolve(val);
              } catch (err) {
                val = PromiseReject(err);
              }
              if (cnt += 1, PromisePrototypeThen(val, afterItemProcessed, onCatch), queue.push(val), next)
                next(), next = null;
              if (!done && (queue.length >= highWaterMark || cnt >= concurrency))
                await new Promise2((resolve) => {
                  resume = resolve;
                });
            }
            queue.push(kEof);
          } catch (err) {
            let val = PromiseReject(err);
            PromisePrototypeThen(val, afterItemProcessed, onCatch), queue.push(val);
          } finally {
            if (done = true, next)
              next(), next = null;
          }
        }
        pump();
        try {
          while (true) {
            while (queue.length > 0) {
              let val = await queue[0];
              if (val === kEof)
                return;
              if (signal.aborted)
                throw new AbortError2;
              if (val !== kEmpty)
                yield val;
              queue.shift(), maybeResume();
            }
            await new Promise2((resolve) => {
              next = resolve;
            });
          }
        } finally {
          if (done = true, resume)
            resume(), resume = null;
        }
      }.call(this);
    }
    function asIndexedPairs(options = undefined) {
      if (options != null)
        validateObject(options, "options");
      if ((options === null || options === undefined ? undefined : options.signal) != null)
        validateAbortSignal2(options.signal, "options.signal");
      return async function* () {
        let index = 0;
        for await (let val of this) {
          var _options$signal;
          if (options !== null && options !== undefined && (_options$signal = options.signal) !== null && _options$signal !== undefined && _options$signal.aborted)
            throw new AbortError2({ cause: options.signal.reason });
          yield [index++, val];
        }
      }.call(this);
    }
    async function some(fn, options = undefined) {
      for await (let unused of filter.call(this, fn, options))
        return true;
      return false;
    }
    async function every(fn, options = undefined) {
      if (typeof fn !== "function")
        throw new ERR_INVALID_ARG_TYPE3("fn", ["Function", "AsyncFunction"], fn);
      return !await some.call(this, async (...args) => {
        return !await fn(...args);
      }, options);
    }
    async function find(fn, options) {
      for await (let result of filter.call(this, fn, options))
        return result;
      return;
    }
    async function forEach(fn, options) {
      if (typeof fn !== "function")
        throw new ERR_INVALID_ARG_TYPE3("fn", ["Function", "AsyncFunction"], fn);
      async function forEachFn(value, options2) {
        return await fn(value, options2), kEmpty;
      }
      for await (let unused of map.call(this, forEachFn, options))
        ;
    }
    function filter(fn, options) {
      if (typeof fn !== "function")
        throw new ERR_INVALID_ARG_TYPE3("fn", ["Function", "AsyncFunction"], fn);
      async function filterFn(value, options2) {
        if (await fn(value, options2))
          return value;
        return kEmpty;
      }
      return map.call(this, filterFn, options);
    }

    class ReduceAwareErrMissingArgs extends ERR_MISSING_ARGS {
      constructor() {
        super("reduce");
        this.message = "Reduce of an empty stream requires an initial value";
      }
    }
    async function reduce(reducer, initialValue, options) {
      var _options$signal2;
      if (typeof reducer !== "function")
        throw new ERR_INVALID_ARG_TYPE3("reducer", ["Function", "AsyncFunction"], reducer);
      if (options != null)
        validateObject(options, "options");
      if ((options === null || options === undefined ? undefined : options.signal) != null)
        validateAbortSignal2(options.signal, "options.signal");
      let hasInitialValue = arguments.length > 1;
      if (options !== null && options !== undefined && (_options$signal2 = options.signal) !== null && _options$signal2 !== undefined && _options$signal2.aborted) {
        let err = new AbortError2(undefined, { cause: options.signal.reason });
        throw this.once("error", () => {}), await finished(this.destroy(err)), err;
      }
      let ac = new AbortController, signal = ac.signal;
      if (options !== null && options !== undefined && options.signal) {
        let opts = { once: true, [kWeakHandler]: this, [kResistStopPropagation]: true };
        options.signal.addEventListener("abort", () => ac.abort(), opts);
      }
      let gotAnyItemFromStream = false;
      try {
        for await (let value of this) {
          var _options$signal3;
          if (gotAnyItemFromStream = true, options !== null && options !== undefined && (_options$signal3 = options.signal) !== null && _options$signal3 !== undefined && _options$signal3.aborted)
            throw new AbortError2;
          if (!hasInitialValue)
            initialValue = value, hasInitialValue = true;
          else
            initialValue = await reducer(initialValue, value, { signal });
        }
        if (!gotAnyItemFromStream && !hasInitialValue)
          throw new ReduceAwareErrMissingArgs;
      } finally {
        ac.abort();
      }
      return initialValue;
    }
    async function toArray(options) {
      if (options != null)
        validateObject(options, "options");
      if ((options === null || options === undefined ? undefined : options.signal) != null)
        validateAbortSignal2(options.signal, "options.signal");
      let result = [];
      for await (let val of this) {
        var _options$signal4;
        if (options !== null && options !== undefined && (_options$signal4 = options.signal) !== null && _options$signal4 !== undefined && _options$signal4.aborted)
          throw new AbortError2(undefined, { cause: options.signal.reason });
        ArrayPrototypePush(result, val);
      }
      return result;
    }
    function flatMap(fn, options) {
      let values = map.call(this, fn, options);
      return async function* () {
        for await (let val of values)
          yield* val;
      }.call(this);
    }
    function toIntegerOrInfinity(number) {
      if (number = Number2(number), NumberIsNaN(number))
        return 0;
      if (number < 0)
        throw new ERR_OUT_OF_RANGE3("number", ">= 0", number);
      return number;
    }
    function drop(number, options = undefined) {
      if (options != null)
        validateObject(options, "options");
      if ((options === null || options === undefined ? undefined : options.signal) != null)
        validateAbortSignal2(options.signal, "options.signal");
      return number = toIntegerOrInfinity(number), async function* () {
        var _options$signal5;
        if (options !== null && options !== undefined && (_options$signal5 = options.signal) !== null && _options$signal5 !== undefined && _options$signal5.aborted)
          throw new AbortError2;
        for await (let val of this) {
          var _options$signal6;
          if (options !== null && options !== undefined && (_options$signal6 = options.signal) !== null && _options$signal6 !== undefined && _options$signal6.aborted)
            throw new AbortError2;
          if (number-- <= 0)
            yield val;
        }
      }.call(this);
    }
    function take(number, options = undefined) {
      if (options != null)
        validateObject(options, "options");
      if ((options === null || options === undefined ? undefined : options.signal) != null)
        validateAbortSignal2(options.signal, "options.signal");
      return number = toIntegerOrInfinity(number), async function* () {
        var _options$signal7;
        if (options !== null && options !== undefined && (_options$signal7 = options.signal) !== null && _options$signal7 !== undefined && _options$signal7.aborted)
          throw new AbortError2;
        for await (let val of this) {
          var _options$signal8;
          if (options !== null && options !== undefined && (_options$signal8 = options.signal) !== null && _options$signal8 !== undefined && _options$signal8.aborted)
            throw new AbortError2;
          if (number-- > 0)
            yield val;
          if (number <= 0)
            return;
        }
      }.call(this);
    }
    module2.exports.streamReturningOperators = { asIndexedPairs: deprecate(asIndexedPairs, "readable.asIndexedPairs will be removed in a future version."), drop, filter, flatMap, map, take, compose };
    module2.exports.promiseReturningOperators = { every, forEach, reduce, toArray, some, find };
  });
  var require_promises = __commonJS2((exports2, module2) => {
    var { ArrayPrototypePop, Promise: Promise2 } = require_primordials(), { isIterable, isNodeStream, isWebStream } = require_utils(), { pipelineImpl: pl } = require_pipeline(), { finished } = require_end_of_stream();
    require_stream2();
    function pipeline(...streams) {
      return new Promise2((resolve, reject) => {
        let signal, end, lastArg = streams[streams.length - 1];
        if (lastArg && typeof lastArg === "object" && !isNodeStream(lastArg) && !isIterable(lastArg) && !isWebStream(lastArg)) {
          let options = ArrayPrototypePop(streams);
          signal = options.signal, end = options.end;
        }
        pl(streams, (err, value) => {
          if (err)
            reject(err);
          else
            resolve(value);
        }, { signal, end });
      });
    }
    module2.exports = { finished, pipeline };
  });
  var require_stream2 = __commonJS2((exports2, module2) => {
    var { Buffer: Buffer3 } = (init_buffer(), __toCommonJS(exports_buffer)), { ObjectDefineProperty, ObjectKeys, ReflectApply } = require_primordials(), { promisify: { custom: customPromisify } } = require_util(), { streamReturningOperators, promiseReturningOperators } = require_operators(), { codes: { ERR_ILLEGAL_CONSTRUCTOR } } = require_errors(), compose = require_compose(), { setDefaultHighWaterMark, getDefaultHighWaterMark } = require_state(), { pipeline } = require_pipeline(), { destroyer } = require_destroy(), eos = require_end_of_stream(), promises = require_promises(), utils = require_utils(), Stream = module2.exports = require_legacy().Stream;
    Stream.isDestroyed = utils.isDestroyed;
    Stream.isDisturbed = utils.isDisturbed;
    Stream.isErrored = utils.isErrored;
    Stream.isReadable = utils.isReadable;
    Stream.isWritable = utils.isWritable;
    Stream.Readable = require_readable();
    for (let key of ObjectKeys(streamReturningOperators)) {
      let fn = function(...args) {
        if (new.target)
          throw ERR_ILLEGAL_CONSTRUCTOR();
        return Stream.Readable.from(ReflectApply(op, this, args));
      }, op = streamReturningOperators[key];
      ObjectDefineProperty(fn, "name", { __proto__: null, value: op.name }), ObjectDefineProperty(fn, "length", { __proto__: null, value: op.length }), ObjectDefineProperty(Stream.Readable.prototype, key, { __proto__: null, value: fn, enumerable: false, configurable: true, writable: true });
    }
    for (let key of ObjectKeys(promiseReturningOperators)) {
      let fn = function(...args) {
        if (new.target)
          throw ERR_ILLEGAL_CONSTRUCTOR();
        return ReflectApply(op, this, args);
      }, op = promiseReturningOperators[key];
      ObjectDefineProperty(fn, "name", { __proto__: null, value: op.name }), ObjectDefineProperty(fn, "length", { __proto__: null, value: op.length }), ObjectDefineProperty(Stream.Readable.prototype, key, { __proto__: null, value: fn, enumerable: false, configurable: true, writable: true });
    }
    Stream.Writable = require_writable();
    Stream.Duplex = require_duplex();
    Stream.Transform = require_transform();
    Stream.PassThrough = require_passthrough();
    Stream.pipeline = pipeline;
    var { addAbortSignal } = require_add_abort_signal();
    Stream.addAbortSignal = addAbortSignal;
    Stream.finished = eos;
    Stream.destroy = destroyer;
    Stream.compose = compose;
    Stream.setDefaultHighWaterMark = setDefaultHighWaterMark;
    Stream.getDefaultHighWaterMark = getDefaultHighWaterMark;
    ObjectDefineProperty(Stream, "promises", { __proto__: null, configurable: true, enumerable: true, get() {
      return promises;
    } });
    ObjectDefineProperty(pipeline, customPromisify, { __proto__: null, enumerable: true, get() {
      return promises.pipeline;
    } });
    ObjectDefineProperty(eos, customPromisify, { __proto__: null, enumerable: true, get() {
      return promises.finished;
    } });
    Stream.Stream = Stream;
    Stream._isUint8Array = function(value) {
      return value instanceof Uint8Array;
    };
    Stream._uint8ArrayToBuffer = function(chunk) {
      return Buffer3.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    };
  });
  var require_ours = __commonJS2((exports2, module2) => {
    var Stream = require_stream();
    {
      let CustomStream = require_stream2(), promises = require_promises(), originalDestroy = CustomStream.Readable.destroy;
      module2.exports = CustomStream.Readable, module2.exports._uint8ArrayToBuffer = CustomStream._uint8ArrayToBuffer, module2.exports._isUint8Array = CustomStream._isUint8Array, module2.exports.isDisturbed = CustomStream.isDisturbed, module2.exports.isErrored = CustomStream.isErrored, module2.exports.isReadable = CustomStream.isReadable, module2.exports.Readable = CustomStream.Readable, module2.exports.Writable = CustomStream.Writable, module2.exports.Duplex = CustomStream.Duplex, module2.exports.Transform = CustomStream.Transform, module2.exports.PassThrough = CustomStream.PassThrough, module2.exports.addAbortSignal = CustomStream.addAbortSignal, module2.exports.finished = CustomStream.finished, module2.exports.destroy = CustomStream.destroy, module2.exports.destroy = originalDestroy, module2.exports.pipeline = CustomStream.pipeline, module2.exports.compose = CustomStream.compose, Object.defineProperty(CustomStream, "promises", { configurable: true, enumerable: true, get() {
        return promises;
      } }), module2.exports.Stream = CustomStream.Stream;
    }
    module2.exports.default = module2.exports;
  });
  module.exports = require_ours();
});

// node_modules/jszip/lib/support.js
var require_support = __commonJS((exports) => {
  exports.base64 = true;
  exports.array = true;
  exports.string = true;
  exports.arraybuffer = typeof ArrayBuffer !== "undefined" && typeof Uint8Array !== "undefined";
  exports.nodebuffer = typeof Buffer !== "undefined";
  exports.uint8array = typeof Uint8Array !== "undefined";
  if (typeof ArrayBuffer === "undefined") {
    exports.blob = false;
  } else {
    buffer = new ArrayBuffer(0);
    try {
      exports.blob = new Blob([buffer], {
        type: "application/zip"
      }).size === 0;
    } catch (e) {
      try {
        Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
        builder = new Builder;
        builder.append(buffer);
        exports.blob = builder.getBlob("application/zip").size === 0;
      } catch (e2) {
        exports.blob = false;
      }
    }
  }
  var buffer;
  var Builder;
  var builder;
  try {
    exports.nodestream = !!require_stream().Readable;
  } catch (e) {
    exports.nodestream = false;
  }
});

// node_modules/jszip/lib/base64.js
var require_base64 = __commonJS((exports) => {
  var utils = require_utils();
  var support = require_support();
  var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  exports.encode = function(input) {
    var output = [];
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i2 = 0, len2 = input.length, remainingBytes = len2;
    var isArray = utils.getTypeOf(input) !== "string";
    while (i2 < input.length) {
      remainingBytes = len2 - i2;
      if (!isArray) {
        chr1 = input.charCodeAt(i2++);
        chr2 = i2 < len2 ? input.charCodeAt(i2++) : 0;
        chr3 = i2 < len2 ? input.charCodeAt(i2++) : 0;
      } else {
        chr1 = input[i2++];
        chr2 = i2 < len2 ? input[i2++] : 0;
        chr3 = i2 < len2 ? input[i2++] : 0;
      }
      enc1 = chr1 >> 2;
      enc2 = (chr1 & 3) << 4 | chr2 >> 4;
      enc3 = remainingBytes > 1 ? (chr2 & 15) << 2 | chr3 >> 6 : 64;
      enc4 = remainingBytes > 2 ? chr3 & 63 : 64;
      output.push(_keyStr.charAt(enc1) + _keyStr.charAt(enc2) + _keyStr.charAt(enc3) + _keyStr.charAt(enc4));
    }
    return output.join("");
  };
  exports.decode = function(input) {
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i2 = 0, resultIndex = 0;
    var dataUrlPrefix = "data:";
    if (input.substr(0, dataUrlPrefix.length) === dataUrlPrefix) {
      throw new Error("Invalid base64 input, it looks like a data url.");
    }
    input = input.replace(/[^A-Za-z0-9+/=]/g, "");
    var totalLength = input.length * 3 / 4;
    if (input.charAt(input.length - 1) === _keyStr.charAt(64)) {
      totalLength--;
    }
    if (input.charAt(input.length - 2) === _keyStr.charAt(64)) {
      totalLength--;
    }
    if (totalLength % 1 !== 0) {
      throw new Error("Invalid base64 input, bad content length.");
    }
    var output;
    if (support.uint8array) {
      output = new Uint8Array(totalLength | 0);
    } else {
      output = new Array(totalLength | 0);
    }
    while (i2 < input.length) {
      enc1 = _keyStr.indexOf(input.charAt(i2++));
      enc2 = _keyStr.indexOf(input.charAt(i2++));
      enc3 = _keyStr.indexOf(input.charAt(i2++));
      enc4 = _keyStr.indexOf(input.charAt(i2++));
      chr1 = enc1 << 2 | enc2 >> 4;
      chr2 = (enc2 & 15) << 4 | enc3 >> 2;
      chr3 = (enc3 & 3) << 6 | enc4;
      output[resultIndex++] = chr1;
      if (enc3 !== 64) {
        output[resultIndex++] = chr2;
      }
      if (enc4 !== 64) {
        output[resultIndex++] = chr3;
      }
    }
    return output;
  };
});

// node_modules/jszip/lib/nodejsUtils.js
var require_nodejsUtils = __commonJS((exports, module) => {
  module.exports = {
    isNode: typeof Buffer !== "undefined",
    newBufferFrom: function(data, encoding) {
      if (Buffer.from && Buffer.from !== Uint8Array.from) {
        return Buffer.from(data, encoding);
      } else {
        if (typeof data === "number") {
          throw new Error('The "data" argument must not be a number');
        }
        return new Buffer(data, encoding);
      }
    },
    allocBuffer: function(size) {
      if (Buffer.alloc) {
        return Buffer.alloc(size);
      } else {
        var buf = new Buffer(size);
        buf.fill(0);
        return buf;
      }
    },
    isBuffer: function(b) {
      return Buffer.isBuffer(b);
    },
    isStream: function(obj) {
      return obj && typeof obj.on === "function" && typeof obj.pause === "function" && typeof obj.resume === "function";
    }
  };
});

// node_modules/immediate/lib/browser.js
var require_browser = __commonJS((exports, module) => {
  var Mutation = global.MutationObserver || global.WebKitMutationObserver;
  var scheduleDrain;
  {
    if (Mutation) {
      called = 0;
      observer = new Mutation(nextTick);
      element = global.document.createTextNode("");
      observer.observe(element, {
        characterData: true
      });
      scheduleDrain = function() {
        element.data = called = ++called % 2;
      };
    } else if (!global.setImmediate && typeof global.MessageChannel !== "undefined") {
      channel = new global.MessageChannel;
      channel.port1.onmessage = nextTick;
      scheduleDrain = function() {
        channel.port2.postMessage(0);
      };
    } else if ("document" in global && "onreadystatechange" in global.document.createElement("script")) {
      scheduleDrain = function() {
        var scriptEl = global.document.createElement("script");
        scriptEl.onreadystatechange = function() {
          nextTick();
          scriptEl.onreadystatechange = null;
          scriptEl.parentNode.removeChild(scriptEl);
          scriptEl = null;
        };
        global.document.documentElement.appendChild(scriptEl);
      };
    } else {
      scheduleDrain = function() {
        setTimeout(nextTick, 0);
      };
    }
  }
  var called;
  var observer;
  var element;
  var channel;
  var draining;
  var queue = [];
  function nextTick() {
    draining = true;
    var i2, oldQueue;
    var len2 = queue.length;
    while (len2) {
      oldQueue = queue;
      queue = [];
      i2 = -1;
      while (++i2 < len2) {
        oldQueue[i2]();
      }
      len2 = queue.length;
    }
    draining = false;
  }
  module.exports = immediate;
  function immediate(task) {
    if (queue.push(task) === 1 && !draining) {
      scheduleDrain();
    }
  }
});

// node_modules/lie/lib/browser.js
var require_browser2 = __commonJS((exports, module) => {
  var immediate = require_browser();
  function INTERNAL() {}
  var handlers = {};
  var REJECTED = ["REJECTED"];
  var FULFILLED = ["FULFILLED"];
  var PENDING = ["PENDING"];
  module.exports = Promise2;
  function Promise2(resolver) {
    if (typeof resolver !== "function") {
      throw new TypeError("resolver must be a function");
    }
    this.state = PENDING;
    this.queue = [];
    this.outcome = undefined;
    if (resolver !== INTERNAL) {
      safelyResolveThenable(this, resolver);
    }
  }
  Promise2.prototype["finally"] = function(callback) {
    if (typeof callback !== "function") {
      return this;
    }
    var p = this.constructor;
    return this.then(resolve2, reject2);
    function resolve2(value) {
      function yes() {
        return value;
      }
      return p.resolve(callback()).then(yes);
    }
    function reject2(reason) {
      function no() {
        throw reason;
      }
      return p.resolve(callback()).then(no);
    }
  };
  Promise2.prototype["catch"] = function(onRejected) {
    return this.then(null, onRejected);
  };
  Promise2.prototype.then = function(onFulfilled, onRejected) {
    if (typeof onFulfilled !== "function" && this.state === FULFILLED || typeof onRejected !== "function" && this.state === REJECTED) {
      return this;
    }
    var promise = new this.constructor(INTERNAL);
    if (this.state !== PENDING) {
      var resolver = this.state === FULFILLED ? onFulfilled : onRejected;
      unwrap(promise, resolver, this.outcome);
    } else {
      this.queue.push(new QueueItem(promise, onFulfilled, onRejected));
    }
    return promise;
  };
  function QueueItem(promise, onFulfilled, onRejected) {
    this.promise = promise;
    if (typeof onFulfilled === "function") {
      this.onFulfilled = onFulfilled;
      this.callFulfilled = this.otherCallFulfilled;
    }
    if (typeof onRejected === "function") {
      this.onRejected = onRejected;
      this.callRejected = this.otherCallRejected;
    }
  }
  QueueItem.prototype.callFulfilled = function(value) {
    handlers.resolve(this.promise, value);
  };
  QueueItem.prototype.otherCallFulfilled = function(value) {
    unwrap(this.promise, this.onFulfilled, value);
  };
  QueueItem.prototype.callRejected = function(value) {
    handlers.reject(this.promise, value);
  };
  QueueItem.prototype.otherCallRejected = function(value) {
    unwrap(this.promise, this.onRejected, value);
  };
  function unwrap(promise, func, value) {
    immediate(function() {
      var returnValue;
      try {
        returnValue = func(value);
      } catch (e) {
        return handlers.reject(promise, e);
      }
      if (returnValue === promise) {
        handlers.reject(promise, new TypeError("Cannot resolve promise with itself"));
      } else {
        handlers.resolve(promise, returnValue);
      }
    });
  }
  handlers.resolve = function(self2, value) {
    var result = tryCatch(getThen, value);
    if (result.status === "error") {
      return handlers.reject(self2, result.value);
    }
    var thenable = result.value;
    if (thenable) {
      safelyResolveThenable(self2, thenable);
    } else {
      self2.state = FULFILLED;
      self2.outcome = value;
      var i2 = -1;
      var len2 = self2.queue.length;
      while (++i2 < len2) {
        self2.queue[i2].callFulfilled(value);
      }
    }
    return self2;
  };
  handlers.reject = function(self2, error) {
    self2.state = REJECTED;
    self2.outcome = error;
    var i2 = -1;
    var len2 = self2.queue.length;
    while (++i2 < len2) {
      self2.queue[i2].callRejected(error);
    }
    return self2;
  };
  function getThen(obj) {
    var then = obj && obj.then;
    if (obj && (typeof obj === "object" || typeof obj === "function") && typeof then === "function") {
      return function appyThen() {
        then.apply(obj, arguments);
      };
    }
  }
  function safelyResolveThenable(self2, thenable) {
    var called = false;
    function onError(value) {
      if (called) {
        return;
      }
      called = true;
      handlers.reject(self2, value);
    }
    function onSuccess(value) {
      if (called) {
        return;
      }
      called = true;
      handlers.resolve(self2, value);
    }
    function tryToUnwrap() {
      thenable(onSuccess, onError);
    }
    var result = tryCatch(tryToUnwrap);
    if (result.status === "error") {
      onError(result.value);
    }
  }
  function tryCatch(func, value) {
    var out = {};
    try {
      out.value = func(value);
      out.status = "success";
    } catch (e) {
      out.status = "error";
      out.value = e;
    }
    return out;
  }
  Promise2.resolve = resolve;
  function resolve(value) {
    if (value instanceof this) {
      return value;
    }
    return handlers.resolve(new this(INTERNAL), value);
  }
  Promise2.reject = reject;
  function reject(reason) {
    var promise = new this(INTERNAL);
    return handlers.reject(promise, reason);
  }
  Promise2.all = all;
  function all(iterable) {
    var self2 = this;
    if (Object.prototype.toString.call(iterable) !== "[object Array]") {
      return this.reject(new TypeError("must be an array"));
    }
    var len2 = iterable.length;
    var called = false;
    if (!len2) {
      return this.resolve([]);
    }
    var values = new Array(len2);
    var resolved = 0;
    var i2 = -1;
    var promise = new this(INTERNAL);
    while (++i2 < len2) {
      allResolver(iterable[i2], i2);
    }
    return promise;
    function allResolver(value, i3) {
      self2.resolve(value).then(resolveFromAll, function(error) {
        if (!called) {
          called = true;
          handlers.reject(promise, error);
        }
      });
      function resolveFromAll(outValue) {
        values[i3] = outValue;
        if (++resolved === len2 && !called) {
          called = true;
          handlers.resolve(promise, values);
        }
      }
    }
  }
  Promise2.race = race;
  function race(iterable) {
    var self2 = this;
    if (Object.prototype.toString.call(iterable) !== "[object Array]") {
      return this.reject(new TypeError("must be an array"));
    }
    var len2 = iterable.length;
    var called = false;
    if (!len2) {
      return this.resolve([]);
    }
    var i2 = -1;
    var promise = new this(INTERNAL);
    while (++i2 < len2) {
      resolver(iterable[i2]);
    }
    return promise;
    function resolver(value) {
      self2.resolve(value).then(function(response) {
        if (!called) {
          called = true;
          handlers.resolve(promise, response);
        }
      }, function(error) {
        if (!called) {
          called = true;
          handlers.reject(promise, error);
        }
      });
    }
  }
});

// node_modules/jszip/lib/external.js
var require_external = __commonJS((exports, module) => {
  var ES6Promise = null;
  if (typeof Promise !== "undefined") {
    ES6Promise = Promise;
  } else {
    ES6Promise = require_browser2();
  }
  module.exports = {
    Promise: ES6Promise
  };
});

// node_modules/setimmediate/setImmediate.js
var require_setImmediate = __commonJS((exports) => {
  (function(global2, undefined2) {
    if (global2.setImmediate) {
      return;
    }
    var nextHandle = 1;
    var tasksByHandle = {};
    var currentlyRunningATask = false;
    var doc = global2.document;
    var registerImmediate;
    function setImmediate2(callback) {
      if (typeof callback !== "function") {
        callback = new Function("" + callback);
      }
      var args = new Array(arguments.length - 1);
      for (var i2 = 0;i2 < args.length; i2++) {
        args[i2] = arguments[i2 + 1];
      }
      var task = { callback, args };
      tasksByHandle[nextHandle] = task;
      registerImmediate(nextHandle);
      return nextHandle++;
    }
    function clearImmediate(handle) {
      delete tasksByHandle[handle];
    }
    function run(task) {
      var callback = task.callback;
      var args = task.args;
      switch (args.length) {
        case 0:
          callback();
          break;
        case 1:
          callback(args[0]);
          break;
        case 2:
          callback(args[0], args[1]);
          break;
        case 3:
          callback(args[0], args[1], args[2]);
          break;
        default:
          callback.apply(undefined2, args);
          break;
      }
    }
    function runIfPresent(handle) {
      if (currentlyRunningATask) {
        setTimeout(runIfPresent, 0, handle);
      } else {
        var task = tasksByHandle[handle];
        if (task) {
          currentlyRunningATask = true;
          try {
            run(task);
          } finally {
            clearImmediate(handle);
            currentlyRunningATask = false;
          }
        }
      }
    }
    function installNextTickImplementation() {
      registerImmediate = function(handle) {
        process.nextTick(function() {
          runIfPresent(handle);
        });
      };
    }
    function canUsePostMessage() {
      if (global2.postMessage && !global2.importScripts) {
        var postMessageIsAsynchronous = true;
        var oldOnMessage = global2.onmessage;
        global2.onmessage = function() {
          postMessageIsAsynchronous = false;
        };
        global2.postMessage("", "*");
        global2.onmessage = oldOnMessage;
        return postMessageIsAsynchronous;
      }
    }
    function installPostMessageImplementation() {
      var messagePrefix = "setImmediate$" + Math.random() + "$";
      var onGlobalMessage = function(event) {
        if (event.source === global2 && typeof event.data === "string" && event.data.indexOf(messagePrefix) === 0) {
          runIfPresent(+event.data.slice(messagePrefix.length));
        }
      };
      if (global2.addEventListener) {
        global2.addEventListener("message", onGlobalMessage, false);
      } else {
        global2.attachEvent("onmessage", onGlobalMessage);
      }
      registerImmediate = function(handle) {
        global2.postMessage(messagePrefix + handle, "*");
      };
    }
    function installMessageChannelImplementation() {
      var channel = new MessageChannel;
      channel.port1.onmessage = function(event) {
        var handle = event.data;
        runIfPresent(handle);
      };
      registerImmediate = function(handle) {
        channel.port2.postMessage(handle);
      };
    }
    function installReadyStateChangeImplementation() {
      var html = doc.documentElement;
      registerImmediate = function(handle) {
        var script = doc.createElement("script");
        script.onreadystatechange = function() {
          runIfPresent(handle);
          script.onreadystatechange = null;
          html.removeChild(script);
          script = null;
        };
        html.appendChild(script);
      };
    }
    function installSetTimeoutImplementation() {
      registerImmediate = function(handle) {
        setTimeout(runIfPresent, 0, handle);
      };
    }
    var attachTo = Object.getPrototypeOf && Object.getPrototypeOf(global2);
    attachTo = attachTo && attachTo.setTimeout ? attachTo : global2;
    if ({}.toString.call(global2.process) === "[object process]") {
      installNextTickImplementation();
    } else if (canUsePostMessage()) {
      installPostMessageImplementation();
    } else if (global2.MessageChannel) {
      installMessageChannelImplementation();
    } else if (doc && "onreadystatechange" in doc.createElement("script")) {
      installReadyStateChangeImplementation();
    } else {
      installSetTimeoutImplementation();
    }
    attachTo.setImmediate = setImmediate2;
    attachTo.clearImmediate = clearImmediate;
  })(typeof self === "undefined" ? typeof global === "undefined" ? exports : global : self);
});

// node_modules/jszip/lib/utils.js
var require_utils = __commonJS((exports) => {
  var support = require_support();
  var base64 = require_base64();
  var nodejsUtils = require_nodejsUtils();
  var external = require_external();
  require_setImmediate();
  function string2binary(str) {
    var result = null;
    if (support.uint8array) {
      result = new Uint8Array(str.length);
    } else {
      result = new Array(str.length);
    }
    return stringToArrayLike(str, result);
  }
  exports.newBlob = function(part, type) {
    exports.checkSupport("blob");
    try {
      return new Blob([part], {
        type
      });
    } catch (e) {
      try {
        var Builder = self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder;
        var builder = new Builder;
        builder.append(part);
        return builder.getBlob(type);
      } catch (e2) {
        throw new Error("Bug : can't construct the Blob.");
      }
    }
  };
  function identity(input) {
    return input;
  }
  function stringToArrayLike(str, array) {
    for (var i2 = 0;i2 < str.length; ++i2) {
      array[i2] = str.charCodeAt(i2) & 255;
    }
    return array;
  }
  var arrayToStringHelper = {
    stringifyByChunk: function(array, type, chunk) {
      var result = [], k = 0, len2 = array.length;
      if (len2 <= chunk) {
        return String.fromCharCode.apply(null, array);
      }
      while (k < len2) {
        if (type === "array" || type === "nodebuffer") {
          result.push(String.fromCharCode.apply(null, array.slice(k, Math.min(k + chunk, len2))));
        } else {
          result.push(String.fromCharCode.apply(null, array.subarray(k, Math.min(k + chunk, len2))));
        }
        k += chunk;
      }
      return result.join("");
    },
    stringifyByChar: function(array) {
      var resultStr = "";
      for (var i2 = 0;i2 < array.length; i2++) {
        resultStr += String.fromCharCode(array[i2]);
      }
      return resultStr;
    },
    applyCanBeUsed: {
      uint8array: function() {
        try {
          return support.uint8array && String.fromCharCode.apply(null, new Uint8Array(1)).length === 1;
        } catch (e) {
          return false;
        }
      }(),
      nodebuffer: function() {
        try {
          return support.nodebuffer && String.fromCharCode.apply(null, nodejsUtils.allocBuffer(1)).length === 1;
        } catch (e) {
          return false;
        }
      }()
    }
  };
  function arrayLikeToString(array) {
    var chunk = 65536, type = exports.getTypeOf(array), canUseApply = true;
    if (type === "uint8array") {
      canUseApply = arrayToStringHelper.applyCanBeUsed.uint8array;
    } else if (type === "nodebuffer") {
      canUseApply = arrayToStringHelper.applyCanBeUsed.nodebuffer;
    }
    if (canUseApply) {
      while (chunk > 1) {
        try {
          return arrayToStringHelper.stringifyByChunk(array, type, chunk);
        } catch (e) {
          chunk = Math.floor(chunk / 2);
        }
      }
    }
    return arrayToStringHelper.stringifyByChar(array);
  }
  exports.applyFromCharCode = arrayLikeToString;
  function arrayLikeToArrayLike(arrayFrom, arrayTo) {
    for (var i2 = 0;i2 < arrayFrom.length; i2++) {
      arrayTo[i2] = arrayFrom[i2];
    }
    return arrayTo;
  }
  var transform = {};
  transform["string"] = {
    string: identity,
    array: function(input) {
      return stringToArrayLike(input, new Array(input.length));
    },
    arraybuffer: function(input) {
      return transform["string"]["uint8array"](input).buffer;
    },
    uint8array: function(input) {
      return stringToArrayLike(input, new Uint8Array(input.length));
    },
    nodebuffer: function(input) {
      return stringToArrayLike(input, nodejsUtils.allocBuffer(input.length));
    }
  };
  transform["array"] = {
    string: arrayLikeToString,
    array: identity,
    arraybuffer: function(input) {
      return new Uint8Array(input).buffer;
    },
    uint8array: function(input) {
      return new Uint8Array(input);
    },
    nodebuffer: function(input) {
      return nodejsUtils.newBufferFrom(input);
    }
  };
  transform["arraybuffer"] = {
    string: function(input) {
      return arrayLikeToString(new Uint8Array(input));
    },
    array: function(input) {
      return arrayLikeToArrayLike(new Uint8Array(input), new Array(input.byteLength));
    },
    arraybuffer: identity,
    uint8array: function(input) {
      return new Uint8Array(input);
    },
    nodebuffer: function(input) {
      return nodejsUtils.newBufferFrom(new Uint8Array(input));
    }
  };
  transform["uint8array"] = {
    string: arrayLikeToString,
    array: function(input) {
      return arrayLikeToArrayLike(input, new Array(input.length));
    },
    arraybuffer: function(input) {
      return input.buffer;
    },
    uint8array: identity,
    nodebuffer: function(input) {
      return nodejsUtils.newBufferFrom(input);
    }
  };
  transform["nodebuffer"] = {
    string: arrayLikeToString,
    array: function(input) {
      return arrayLikeToArrayLike(input, new Array(input.length));
    },
    arraybuffer: function(input) {
      return transform["nodebuffer"]["uint8array"](input).buffer;
    },
    uint8array: function(input) {
      return arrayLikeToArrayLike(input, new Uint8Array(input.length));
    },
    nodebuffer: identity
  };
  exports.transformTo = function(outputType, input) {
    if (!input) {
      input = "";
    }
    if (!outputType) {
      return input;
    }
    exports.checkSupport(outputType);
    var inputType = exports.getTypeOf(input);
    var result = transform[inputType][outputType](input);
    return result;
  };
  exports.resolve = function(path) {
    var parts = path.split("/");
    var result = [];
    for (var index = 0;index < parts.length; index++) {
      var part = parts[index];
      if (part === "." || part === "" && index !== 0 && index !== parts.length - 1) {
        continue;
      } else if (part === "..") {
        result.pop();
      } else {
        result.push(part);
      }
    }
    return result.join("/");
  };
  exports.getTypeOf = function(input) {
    if (typeof input === "string") {
      return "string";
    }
    if (Object.prototype.toString.call(input) === "[object Array]") {
      return "array";
    }
    if (support.nodebuffer && nodejsUtils.isBuffer(input)) {
      return "nodebuffer";
    }
    if (support.uint8array && input instanceof Uint8Array) {
      return "uint8array";
    }
    if (support.arraybuffer && input instanceof ArrayBuffer) {
      return "arraybuffer";
    }
  };
  exports.checkSupport = function(type) {
    var supported = support[type.toLowerCase()];
    if (!supported) {
      throw new Error(type + " is not supported by this platform");
    }
  };
  exports.MAX_VALUE_16BITS = 65535;
  exports.MAX_VALUE_32BITS = -1;
  exports.pretty = function(str) {
    var res = "", code2, i2;
    for (i2 = 0;i2 < (str || "").length; i2++) {
      code2 = str.charCodeAt(i2);
      res += "\\x" + (code2 < 16 ? "0" : "") + code2.toString(16).toUpperCase();
    }
    return res;
  };
  exports.delay = function(callback, args, self2) {
    setImmediate(function() {
      callback.apply(self2 || null, args || []);
    });
  };
  exports.inherits = function(ctor, superCtor) {
    var Obj = function() {};
    Obj.prototype = superCtor.prototype;
    ctor.prototype = new Obj;
  };
  exports.extend = function() {
    var result = {}, i2, attr;
    for (i2 = 0;i2 < arguments.length; i2++) {
      for (attr in arguments[i2]) {
        if (Object.prototype.hasOwnProperty.call(arguments[i2], attr) && typeof result[attr] === "undefined") {
          result[attr] = arguments[i2][attr];
        }
      }
    }
    return result;
  };
  exports.prepareContent = function(name, inputData, isBinary, isOptimizedBinaryString, isBase64) {
    var promise = external.Promise.resolve(inputData).then(function(data) {
      var isBlob = support.blob && (data instanceof Blob || ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(data)) !== -1);
      if (isBlob && typeof FileReader !== "undefined") {
        return new external.Promise(function(resolve, reject) {
          var reader = new FileReader;
          reader.onload = function(e) {
            resolve(e.target.result);
          };
          reader.onerror = function(e) {
            reject(e.target.error);
          };
          reader.readAsArrayBuffer(data);
        });
      } else {
        return data;
      }
    });
    return promise.then(function(data) {
      var dataType = exports.getTypeOf(data);
      if (!dataType) {
        return external.Promise.reject(new Error("Can't read the data of '" + name + "'. Is it " + "in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
      }
      if (dataType === "arraybuffer") {
        data = exports.transformTo("uint8array", data);
      } else if (dataType === "string") {
        if (isBase64) {
          data = base64.decode(data);
        } else if (isBinary) {
          if (isOptimizedBinaryString !== true) {
            data = string2binary(data);
          }
        }
      }
      return data;
    });
  };
});

// node_modules/jszip/lib/stream/GenericWorker.js
var require_GenericWorker = __commonJS((exports, module) => {
  function GenericWorker(name) {
    this.name = name || "default";
    this.streamInfo = {};
    this.generatedError = null;
    this.extraStreamInfo = {};
    this.isPaused = true;
    this.isFinished = false;
    this.isLocked = false;
    this._listeners = {
      data: [],
      end: [],
      error: []
    };
    this.previous = null;
  }
  GenericWorker.prototype = {
    push: function(chunk) {
      this.emit("data", chunk);
    },
    end: function() {
      if (this.isFinished) {
        return false;
      }
      this.flush();
      try {
        this.emit("end");
        this.cleanUp();
        this.isFinished = true;
      } catch (e) {
        this.emit("error", e);
      }
      return true;
    },
    error: function(e) {
      if (this.isFinished) {
        return false;
      }
      if (this.isPaused) {
        this.generatedError = e;
      } else {
        this.isFinished = true;
        this.emit("error", e);
        if (this.previous) {
          this.previous.error(e);
        }
        this.cleanUp();
      }
      return true;
    },
    on: function(name, listener) {
      this._listeners[name].push(listener);
      return this;
    },
    cleanUp: function() {
      this.streamInfo = this.generatedError = this.extraStreamInfo = null;
      this._listeners = [];
    },
    emit: function(name, arg) {
      if (this._listeners[name]) {
        for (var i2 = 0;i2 < this._listeners[name].length; i2++) {
          this._listeners[name][i2].call(this, arg);
        }
      }
    },
    pipe: function(next) {
      return next.registerPrevious(this);
    },
    registerPrevious: function(previous) {
      if (this.isLocked) {
        throw new Error("The stream '" + this + "' has already been used.");
      }
      this.streamInfo = previous.streamInfo;
      this.mergeStreamInfo();
      this.previous = previous;
      var self2 = this;
      previous.on("data", function(chunk) {
        self2.processChunk(chunk);
      });
      previous.on("end", function() {
        self2.end();
      });
      previous.on("error", function(e) {
        self2.error(e);
      });
      return this;
    },
    pause: function() {
      if (this.isPaused || this.isFinished) {
        return false;
      }
      this.isPaused = true;
      if (this.previous) {
        this.previous.pause();
      }
      return true;
    },
    resume: function() {
      if (!this.isPaused || this.isFinished) {
        return false;
      }
      this.isPaused = false;
      var withError = false;
      if (this.generatedError) {
        this.error(this.generatedError);
        withError = true;
      }
      if (this.previous) {
        this.previous.resume();
      }
      return !withError;
    },
    flush: function() {},
    processChunk: function(chunk) {
      this.push(chunk);
    },
    withStreamInfo: function(key, value) {
      this.extraStreamInfo[key] = value;
      this.mergeStreamInfo();
      return this;
    },
    mergeStreamInfo: function() {
      for (var key in this.extraStreamInfo) {
        if (!Object.prototype.hasOwnProperty.call(this.extraStreamInfo, key)) {
          continue;
        }
        this.streamInfo[key] = this.extraStreamInfo[key];
      }
    },
    lock: function() {
      if (this.isLocked) {
        throw new Error("The stream '" + this + "' has already been used.");
      }
      this.isLocked = true;
      if (this.previous) {
        this.previous.lock();
      }
    },
    toString: function() {
      var me = "Worker " + this.name;
      if (this.previous) {
        return this.previous + " -> " + me;
      } else {
        return me;
      }
    }
  };
  module.exports = GenericWorker;
});

// node_modules/jszip/lib/utf8.js
var require_utf8 = __commonJS((exports) => {
  var utils = require_utils();
  var support = require_support();
  var nodejsUtils = require_nodejsUtils();
  var GenericWorker = require_GenericWorker();
  var _utf8len = new Array(256);
  for (i2 = 0;i2 < 256; i2++) {
    _utf8len[i2] = i2 >= 252 ? 6 : i2 >= 248 ? 5 : i2 >= 240 ? 4 : i2 >= 224 ? 3 : i2 >= 192 ? 2 : 1;
  }
  var i2;
  _utf8len[254] = _utf8len[254] = 1;
  var string2buf = function(str) {
    var buf, c, c2, m_pos, i3, str_len = str.length, buf_len = 0;
    for (m_pos = 0;m_pos < str_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
    }
    if (support.uint8array) {
      buf = new Uint8Array(buf_len);
    } else {
      buf = new Array(buf_len);
    }
    for (i3 = 0, m_pos = 0;i3 < buf_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      if (c < 128) {
        buf[i3++] = c;
      } else if (c < 2048) {
        buf[i3++] = 192 | c >>> 6;
        buf[i3++] = 128 | c & 63;
      } else if (c < 65536) {
        buf[i3++] = 224 | c >>> 12;
        buf[i3++] = 128 | c >>> 6 & 63;
        buf[i3++] = 128 | c & 63;
      } else {
        buf[i3++] = 240 | c >>> 18;
        buf[i3++] = 128 | c >>> 12 & 63;
        buf[i3++] = 128 | c >>> 6 & 63;
        buf[i3++] = 128 | c & 63;
      }
    }
    return buf;
  };
  var utf8border = function(buf, max) {
    var pos;
    max = max || buf.length;
    if (max > buf.length) {
      max = buf.length;
    }
    pos = max - 1;
    while (pos >= 0 && (buf[pos] & 192) === 128) {
      pos--;
    }
    if (pos < 0) {
      return max;
    }
    if (pos === 0) {
      return max;
    }
    return pos + _utf8len[buf[pos]] > max ? pos : max;
  };
  var buf2string = function(buf) {
    var i3, out, c, c_len;
    var len2 = buf.length;
    var utf16buf = new Array(len2 * 2);
    for (out = 0, i3 = 0;i3 < len2; ) {
      c = buf[i3++];
      if (c < 128) {
        utf16buf[out++] = c;
        continue;
      }
      c_len = _utf8len[c];
      if (c_len > 4) {
        utf16buf[out++] = 65533;
        i3 += c_len - 1;
        continue;
      }
      c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
      while (c_len > 1 && i3 < len2) {
        c = c << 6 | buf[i3++] & 63;
        c_len--;
      }
      if (c_len > 1) {
        utf16buf[out++] = 65533;
        continue;
      }
      if (c < 65536) {
        utf16buf[out++] = c;
      } else {
        c -= 65536;
        utf16buf[out++] = 55296 | c >> 10 & 1023;
        utf16buf[out++] = 56320 | c & 1023;
      }
    }
    if (utf16buf.length !== out) {
      if (utf16buf.subarray) {
        utf16buf = utf16buf.subarray(0, out);
      } else {
        utf16buf.length = out;
      }
    }
    return utils.applyFromCharCode(utf16buf);
  };
  exports.utf8encode = function utf8encode(str) {
    if (support.nodebuffer) {
      return nodejsUtils.newBufferFrom(str, "utf-8");
    }
    return string2buf(str);
  };
  exports.utf8decode = function utf8decode(buf) {
    if (support.nodebuffer) {
      return utils.transformTo("nodebuffer", buf).toString("utf-8");
    }
    buf = utils.transformTo(support.uint8array ? "uint8array" : "array", buf);
    return buf2string(buf);
  };
  function Utf8DecodeWorker() {
    GenericWorker.call(this, "utf-8 decode");
    this.leftOver = null;
  }
  utils.inherits(Utf8DecodeWorker, GenericWorker);
  Utf8DecodeWorker.prototype.processChunk = function(chunk) {
    var data = utils.transformTo(support.uint8array ? "uint8array" : "array", chunk.data);
    if (this.leftOver && this.leftOver.length) {
      if (support.uint8array) {
        var previousData = data;
        data = new Uint8Array(previousData.length + this.leftOver.length);
        data.set(this.leftOver, 0);
        data.set(previousData, this.leftOver.length);
      } else {
        data = this.leftOver.concat(data);
      }
      this.leftOver = null;
    }
    var nextBoundary = utf8border(data);
    var usableData = data;
    if (nextBoundary !== data.length) {
      if (support.uint8array) {
        usableData = data.subarray(0, nextBoundary);
        this.leftOver = data.subarray(nextBoundary, data.length);
      } else {
        usableData = data.slice(0, nextBoundary);
        this.leftOver = data.slice(nextBoundary, data.length);
      }
    }
    this.push({
      data: exports.utf8decode(usableData),
      meta: chunk.meta
    });
  };
  Utf8DecodeWorker.prototype.flush = function() {
    if (this.leftOver && this.leftOver.length) {
      this.push({
        data: exports.utf8decode(this.leftOver),
        meta: {}
      });
      this.leftOver = null;
    }
  };
  exports.Utf8DecodeWorker = Utf8DecodeWorker;
  function Utf8EncodeWorker() {
    GenericWorker.call(this, "utf-8 encode");
  }
  utils.inherits(Utf8EncodeWorker, GenericWorker);
  Utf8EncodeWorker.prototype.processChunk = function(chunk) {
    this.push({
      data: exports.utf8encode(chunk.data),
      meta: chunk.meta
    });
  };
  exports.Utf8EncodeWorker = Utf8EncodeWorker;
});

// node_modules/jszip/lib/stream/ConvertWorker.js
var require_ConvertWorker = __commonJS((exports, module) => {
  var GenericWorker = require_GenericWorker();
  var utils = require_utils();
  function ConvertWorker(destType) {
    GenericWorker.call(this, "ConvertWorker to " + destType);
    this.destType = destType;
  }
  utils.inherits(ConvertWorker, GenericWorker);
  ConvertWorker.prototype.processChunk = function(chunk) {
    this.push({
      data: utils.transformTo(this.destType, chunk.data),
      meta: chunk.meta
    });
  };
  module.exports = ConvertWorker;
});

// node_modules/jszip/lib/nodejs/NodejsStreamOutputAdapter.js
var require_NodejsStreamOutputAdapter = __commonJS((exports, module) => {
  var Readable = require_stream().Readable;
  var utils = require_utils();
  utils.inherits(NodejsStreamOutputAdapter, Readable);
  function NodejsStreamOutputAdapter(helper, options, updateCb) {
    Readable.call(this, options);
    this._helper = helper;
    var self2 = this;
    helper.on("data", function(data, meta) {
      if (!self2.push(data)) {
        self2._helper.pause();
      }
      if (updateCb) {
        updateCb(meta);
      }
    }).on("error", function(e) {
      self2.emit("error", e);
    }).on("end", function() {
      self2.push(null);
    });
  }
  NodejsStreamOutputAdapter.prototype._read = function() {
    this._helper.resume();
  };
  module.exports = NodejsStreamOutputAdapter;
});

// node_modules/jszip/lib/stream/StreamHelper.js
var require_StreamHelper = __commonJS((exports, module) => {
  var utils = require_utils();
  var ConvertWorker = require_ConvertWorker();
  var GenericWorker = require_GenericWorker();
  var base64 = require_base64();
  var support = require_support();
  var external = require_external();
  var NodejsStreamOutputAdapter = null;
  if (support.nodestream) {
    try {
      NodejsStreamOutputAdapter = require_NodejsStreamOutputAdapter();
    } catch (e) {}
  }
  function transformZipOutput(type, content, mimeType) {
    switch (type) {
      case "blob":
        return utils.newBlob(utils.transformTo("arraybuffer", content), mimeType);
      case "base64":
        return base64.encode(content);
      default:
        return utils.transformTo(type, content);
    }
  }
  function concat(type, dataArray) {
    var i2, index = 0, res = null, totalLength = 0;
    for (i2 = 0;i2 < dataArray.length; i2++) {
      totalLength += dataArray[i2].length;
    }
    switch (type) {
      case "string":
        return dataArray.join("");
      case "array":
        return Array.prototype.concat.apply([], dataArray);
      case "uint8array":
        res = new Uint8Array(totalLength);
        for (i2 = 0;i2 < dataArray.length; i2++) {
          res.set(dataArray[i2], index);
          index += dataArray[i2].length;
        }
        return res;
      case "nodebuffer":
        return Buffer.concat(dataArray);
      default:
        throw new Error("concat : unsupported type '" + type + "'");
    }
  }
  function accumulate(helper, updateCallback) {
    return new external.Promise(function(resolve, reject) {
      var dataArray = [];
      var { _internalType: chunkType, _outputType: resultType, _mimeType: mimeType } = helper;
      helper.on("data", function(data, meta) {
        dataArray.push(data);
        if (updateCallback) {
          updateCallback(meta);
        }
      }).on("error", function(err) {
        dataArray = [];
        reject(err);
      }).on("end", function() {
        try {
          var result = transformZipOutput(resultType, concat(chunkType, dataArray), mimeType);
          resolve(result);
        } catch (e) {
          reject(e);
        }
        dataArray = [];
      }).resume();
    });
  }
  function StreamHelper(worker, outputType, mimeType) {
    var internalType = outputType;
    switch (outputType) {
      case "blob":
      case "arraybuffer":
        internalType = "uint8array";
        break;
      case "base64":
        internalType = "string";
        break;
    }
    try {
      this._internalType = internalType;
      this._outputType = outputType;
      this._mimeType = mimeType;
      utils.checkSupport(internalType);
      this._worker = worker.pipe(new ConvertWorker(internalType));
      worker.lock();
    } catch (e) {
      this._worker = new GenericWorker("error");
      this._worker.error(e);
    }
  }
  StreamHelper.prototype = {
    accumulate: function(updateCb) {
      return accumulate(this, updateCb);
    },
    on: function(evt, fn) {
      var self2 = this;
      if (evt === "data") {
        this._worker.on(evt, function(chunk) {
          fn.call(self2, chunk.data, chunk.meta);
        });
      } else {
        this._worker.on(evt, function() {
          utils.delay(fn, arguments, self2);
        });
      }
      return this;
    },
    resume: function() {
      utils.delay(this._worker.resume, [], this._worker);
      return this;
    },
    pause: function() {
      this._worker.pause();
      return this;
    },
    toNodejsStream: function(updateCb) {
      utils.checkSupport("nodestream");
      if (this._outputType !== "nodebuffer") {
        throw new Error(this._outputType + " is not supported by this method");
      }
      return new NodejsStreamOutputAdapter(this, {
        objectMode: this._outputType !== "nodebuffer"
      }, updateCb);
    }
  };
  module.exports = StreamHelper;
});

// node_modules/jszip/lib/defaults.js
var require_defaults = __commonJS((exports) => {
  exports.base64 = false;
  exports.binary = false;
  exports.dir = false;
  exports.createFolders = true;
  exports.date = null;
  exports.compression = null;
  exports.compressionOptions = null;
  exports.comment = null;
  exports.unixPermissions = null;
  exports.dosPermissions = null;
});

// node_modules/jszip/lib/stream/DataWorker.js
var require_DataWorker = __commonJS((exports, module) => {
  var utils = require_utils();
  var GenericWorker = require_GenericWorker();
  var DEFAULT_BLOCK_SIZE = 16 * 1024;
  function DataWorker(dataP) {
    GenericWorker.call(this, "DataWorker");
    var self2 = this;
    this.dataIsReady = false;
    this.index = 0;
    this.max = 0;
    this.data = null;
    this.type = "";
    this._tickScheduled = false;
    dataP.then(function(data) {
      self2.dataIsReady = true;
      self2.data = data;
      self2.max = data && data.length || 0;
      self2.type = utils.getTypeOf(data);
      if (!self2.isPaused) {
        self2._tickAndRepeat();
      }
    }, function(e) {
      self2.error(e);
    });
  }
  utils.inherits(DataWorker, GenericWorker);
  DataWorker.prototype.cleanUp = function() {
    GenericWorker.prototype.cleanUp.call(this);
    this.data = null;
  };
  DataWorker.prototype.resume = function() {
    if (!GenericWorker.prototype.resume.call(this)) {
      return false;
    }
    if (!this._tickScheduled && this.dataIsReady) {
      this._tickScheduled = true;
      utils.delay(this._tickAndRepeat, [], this);
    }
    return true;
  };
  DataWorker.prototype._tickAndRepeat = function() {
    this._tickScheduled = false;
    if (this.isPaused || this.isFinished) {
      return;
    }
    this._tick();
    if (!this.isFinished) {
      utils.delay(this._tickAndRepeat, [], this);
      this._tickScheduled = true;
    }
  };
  DataWorker.prototype._tick = function() {
    if (this.isPaused || this.isFinished) {
      return false;
    }
    var size = DEFAULT_BLOCK_SIZE;
    var data = null, nextIndex = Math.min(this.max, this.index + size);
    if (this.index >= this.max) {
      return this.end();
    } else {
      switch (this.type) {
        case "string":
          data = this.data.substring(this.index, nextIndex);
          break;
        case "uint8array":
          data = this.data.subarray(this.index, nextIndex);
          break;
        case "array":
        case "nodebuffer":
          data = this.data.slice(this.index, nextIndex);
          break;
      }
      this.index = nextIndex;
      return this.push({
        data,
        meta: {
          percent: this.max ? this.index / this.max * 100 : 0
        }
      });
    }
  };
  module.exports = DataWorker;
});

// node_modules/jszip/lib/crc32.js
var require_crc32 = __commonJS((exports, module) => {
  var utils = require_utils();
  function makeTable() {
    var c, table = [];
    for (var n = 0;n < 256; n++) {
      c = n;
      for (var k = 0;k < 8; k++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  }
  var crcTable = makeTable();
  function crc32(crc, buf, len2, pos) {
    var t = crcTable, end = pos + len2;
    crc = crc ^ -1;
    for (var i2 = pos;i2 < end; i2++) {
      crc = crc >>> 8 ^ t[(crc ^ buf[i2]) & 255];
    }
    return crc ^ -1;
  }
  function crc32str(crc, str, len2, pos) {
    var t = crcTable, end = pos + len2;
    crc = crc ^ -1;
    for (var i2 = pos;i2 < end; i2++) {
      crc = crc >>> 8 ^ t[(crc ^ str.charCodeAt(i2)) & 255];
    }
    return crc ^ -1;
  }
  module.exports = function crc32wrapper(input, crc) {
    if (typeof input === "undefined" || !input.length) {
      return 0;
    }
    var isArray = utils.getTypeOf(input) !== "string";
    if (isArray) {
      return crc32(crc | 0, input, input.length, 0);
    } else {
      return crc32str(crc | 0, input, input.length, 0);
    }
  };
});

// node_modules/jszip/lib/stream/Crc32Probe.js
var require_Crc32Probe = __commonJS((exports, module) => {
  var GenericWorker = require_GenericWorker();
  var crc32 = require_crc32();
  var utils = require_utils();
  function Crc32Probe() {
    GenericWorker.call(this, "Crc32Probe");
    this.withStreamInfo("crc32", 0);
  }
  utils.inherits(Crc32Probe, GenericWorker);
  Crc32Probe.prototype.processChunk = function(chunk) {
    this.streamInfo.crc32 = crc32(chunk.data, this.streamInfo.crc32 || 0);
    this.push(chunk);
  };
  module.exports = Crc32Probe;
});

// node_modules/jszip/lib/stream/DataLengthProbe.js
var require_DataLengthProbe = __commonJS((exports, module) => {
  var utils = require_utils();
  var GenericWorker = require_GenericWorker();
  function DataLengthProbe(propName) {
    GenericWorker.call(this, "DataLengthProbe for " + propName);
    this.propName = propName;
    this.withStreamInfo(propName, 0);
  }
  utils.inherits(DataLengthProbe, GenericWorker);
  DataLengthProbe.prototype.processChunk = function(chunk) {
    if (chunk) {
      var length = this.streamInfo[this.propName] || 0;
      this.streamInfo[this.propName] = length + chunk.data.length;
    }
    GenericWorker.prototype.processChunk.call(this, chunk);
  };
  module.exports = DataLengthProbe;
});

// node_modules/jszip/lib/compressedObject.js
var require_compressedObject = __commonJS((exports, module) => {
  var external = require_external();
  var DataWorker = require_DataWorker();
  var Crc32Probe = require_Crc32Probe();
  var DataLengthProbe = require_DataLengthProbe();
  function CompressedObject(compressedSize, uncompressedSize, crc32, compression, data) {
    this.compressedSize = compressedSize;
    this.uncompressedSize = uncompressedSize;
    this.crc32 = crc32;
    this.compression = compression;
    this.compressedContent = data;
  }
  CompressedObject.prototype = {
    getContentWorker: function() {
      var worker = new DataWorker(external.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new DataLengthProbe("data_length"));
      var that = this;
      worker.on("end", function() {
        if (this.streamInfo["data_length"] !== that.uncompressedSize) {
          throw new Error("Bug : uncompressed data size mismatch");
        }
      });
      return worker;
    },
    getCompressedWorker: function() {
      return new DataWorker(external.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
    }
  };
  CompressedObject.createWorkerFrom = function(uncompressedWorker, compression, compressionOptions) {
    return uncompressedWorker.pipe(new Crc32Probe).pipe(new DataLengthProbe("uncompressedSize")).pipe(compression.compressWorker(compressionOptions)).pipe(new DataLengthProbe("compressedSize")).withStreamInfo("compression", compression);
  };
  module.exports = CompressedObject;
});

// node_modules/jszip/lib/zipObject.js
var require_zipObject = __commonJS((exports, module) => {
  var StreamHelper = require_StreamHelper();
  var DataWorker = require_DataWorker();
  var utf8 = require_utf8();
  var CompressedObject = require_compressedObject();
  var GenericWorker = require_GenericWorker();
  var ZipObject = function(name, data, options) {
    this.name = name;
    this.dir = options.dir;
    this.date = options.date;
    this.comment = options.comment;
    this.unixPermissions = options.unixPermissions;
    this.dosPermissions = options.dosPermissions;
    this._data = data;
    this._dataBinary = options.binary;
    this.options = {
      compression: options.compression,
      compressionOptions: options.compressionOptions
    };
  };
  ZipObject.prototype = {
    internalStream: function(type) {
      var result = null, outputType = "string";
      try {
        if (!type) {
          throw new Error("No output type specified.");
        }
        outputType = type.toLowerCase();
        var askUnicodeString = outputType === "string" || outputType === "text";
        if (outputType === "binarystring" || outputType === "text") {
          outputType = "string";
        }
        result = this._decompressWorker();
        var isUnicodeString = !this._dataBinary;
        if (isUnicodeString && !askUnicodeString) {
          result = result.pipe(new utf8.Utf8EncodeWorker);
        }
        if (!isUnicodeString && askUnicodeString) {
          result = result.pipe(new utf8.Utf8DecodeWorker);
        }
      } catch (e) {
        result = new GenericWorker("error");
        result.error(e);
      }
      return new StreamHelper(result, outputType, "");
    },
    async: function(type, onUpdate) {
      return this.internalStream(type).accumulate(onUpdate);
    },
    nodeStream: function(type, onUpdate) {
      return this.internalStream(type || "nodebuffer").toNodejsStream(onUpdate);
    },
    _compressWorker: function(compression, compressionOptions) {
      if (this._data instanceof CompressedObject && this._data.compression.magic === compression.magic) {
        return this._data.getCompressedWorker();
      } else {
        var result = this._decompressWorker();
        if (!this._dataBinary) {
          result = result.pipe(new utf8.Utf8EncodeWorker);
        }
        return CompressedObject.createWorkerFrom(result, compression, compressionOptions);
      }
    },
    _decompressWorker: function() {
      if (this._data instanceof CompressedObject) {
        return this._data.getContentWorker();
      } else if (this._data instanceof GenericWorker) {
        return this._data;
      } else {
        return new DataWorker(this._data);
      }
    }
  };
  var removedMethods = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"];
  var removedFn = function() {
    throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
  };
  for (i2 = 0;i2 < removedMethods.length; i2++) {
    ZipObject.prototype[removedMethods[i2]] = removedFn;
  }
  var i2;
  module.exports = ZipObject;
});

// node_modules/pako/lib/utils/common.js
var require_common = __commonJS((exports) => {
  var TYPED_OK = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Int32Array !== "undefined";
  function _has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
  exports.assign = function(obj) {
    var sources = Array.prototype.slice.call(arguments, 1);
    while (sources.length) {
      var source = sources.shift();
      if (!source) {
        continue;
      }
      if (typeof source !== "object") {
        throw new TypeError(source + "must be non-object");
      }
      for (var p in source) {
        if (_has(source, p)) {
          obj[p] = source[p];
        }
      }
    }
    return obj;
  };
  exports.shrinkBuf = function(buf, size) {
    if (buf.length === size) {
      return buf;
    }
    if (buf.subarray) {
      return buf.subarray(0, size);
    }
    buf.length = size;
    return buf;
  };
  var fnTyped = {
    arraySet: function(dest, src, src_offs, len2, dest_offs) {
      if (src.subarray && dest.subarray) {
        dest.set(src.subarray(src_offs, src_offs + len2), dest_offs);
        return;
      }
      for (var i2 = 0;i2 < len2; i2++) {
        dest[dest_offs + i2] = src[src_offs + i2];
      }
    },
    flattenChunks: function(chunks) {
      var i2, l, len2, pos, chunk, result;
      len2 = 0;
      for (i2 = 0, l = chunks.length;i2 < l; i2++) {
        len2 += chunks[i2].length;
      }
      result = new Uint8Array(len2);
      pos = 0;
      for (i2 = 0, l = chunks.length;i2 < l; i2++) {
        chunk = chunks[i2];
        result.set(chunk, pos);
        pos += chunk.length;
      }
      return result;
    }
  };
  var fnUntyped = {
    arraySet: function(dest, src, src_offs, len2, dest_offs) {
      for (var i2 = 0;i2 < len2; i2++) {
        dest[dest_offs + i2] = src[src_offs + i2];
      }
    },
    flattenChunks: function(chunks) {
      return [].concat.apply([], chunks);
    }
  };
  exports.setTyped = function(on) {
    if (on) {
      exports.Buf8 = Uint8Array;
      exports.Buf16 = Uint16Array;
      exports.Buf32 = Int32Array;
      exports.assign(exports, fnTyped);
    } else {
      exports.Buf8 = Array;
      exports.Buf16 = Array;
      exports.Buf32 = Array;
      exports.assign(exports, fnUntyped);
    }
  };
  exports.setTyped(TYPED_OK);
});

// node_modules/pako/lib/zlib/trees.js
var require_trees = __commonJS((exports) => {
  var utils = require_common();
  var Z_FIXED = 4;
  var Z_BINARY = 0;
  var Z_TEXT = 1;
  var Z_UNKNOWN = 2;
  function zero(buf) {
    var len2 = buf.length;
    while (--len2 >= 0) {
      buf[len2] = 0;
    }
  }
  var STORED_BLOCK = 0;
  var STATIC_TREES = 1;
  var DYN_TREES = 2;
  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var LENGTH_CODES = 29;
  var LITERALS = 256;
  var L_CODES = LITERALS + 1 + LENGTH_CODES;
  var D_CODES = 30;
  var BL_CODES = 19;
  var HEAP_SIZE = 2 * L_CODES + 1;
  var MAX_BITS = 15;
  var Buf_size = 16;
  var MAX_BL_BITS = 7;
  var END_BLOCK = 256;
  var REP_3_6 = 16;
  var REPZ_3_10 = 17;
  var REPZ_11_138 = 18;
  var extra_lbits = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var extra_dbits = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var extra_blbits = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];
  var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  var DIST_CODE_LEN = 512;
  var static_ltree = new Array((L_CODES + 2) * 2);
  zero(static_ltree);
  var static_dtree = new Array(D_CODES * 2);
  zero(static_dtree);
  var _dist_code = new Array(DIST_CODE_LEN);
  zero(_dist_code);
  var _length_code = new Array(MAX_MATCH - MIN_MATCH + 1);
  zero(_length_code);
  var base_length = new Array(LENGTH_CODES);
  zero(base_length);
  var base_dist = new Array(D_CODES);
  zero(base_dist);
  function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {
    this.static_tree = static_tree;
    this.extra_bits = extra_bits;
    this.extra_base = extra_base;
    this.elems = elems;
    this.max_length = max_length;
    this.has_stree = static_tree && static_tree.length;
  }
  var static_l_desc;
  var static_d_desc;
  var static_bl_desc;
  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree;
    this.max_code = 0;
    this.stat_desc = stat_desc;
  }
  function d_code(dist) {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
  }
  function put_short(s, w) {
    s.pending_buf[s.pending++] = w & 255;
    s.pending_buf[s.pending++] = w >>> 8 & 255;
  }
  function send_bits(s, value, length) {
    if (s.bi_valid > Buf_size - length) {
      s.bi_buf |= value << s.bi_valid & 65535;
      put_short(s, s.bi_buf);
      s.bi_buf = value >> Buf_size - s.bi_valid;
      s.bi_valid += length - Buf_size;
    } else {
      s.bi_buf |= value << s.bi_valid & 65535;
      s.bi_valid += length;
    }
  }
  function send_code(s, c, tree) {
    send_bits(s, tree[c * 2], tree[c * 2 + 1]);
  }
  function bi_reverse(code2, len2) {
    var res = 0;
    do {
      res |= code2 & 1;
      code2 >>>= 1;
      res <<= 1;
    } while (--len2 > 0);
    return res >>> 1;
  }
  function bi_flush(s) {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf);
      s.bi_buf = 0;
      s.bi_valid = 0;
    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 255;
      s.bi_buf >>= 8;
      s.bi_valid -= 8;
    }
  }
  function gen_bitlen(s, desc) {
    var tree = desc.dyn_tree;
    var max_code = desc.max_code;
    var stree = desc.stat_desc.static_tree;
    var has_stree = desc.stat_desc.has_stree;
    var extra = desc.stat_desc.extra_bits;
    var base = desc.stat_desc.extra_base;
    var max_length = desc.stat_desc.max_length;
    var h;
    var n, m;
    var bits;
    var xbits;
    var f;
    var overflow = 0;
    for (bits = 0;bits <= MAX_BITS; bits++) {
      s.bl_count[bits] = 0;
    }
    tree[s.heap[s.heap_max] * 2 + 1] = 0;
    for (h = s.heap_max + 1;h < HEAP_SIZE; h++) {
      n = s.heap[h];
      bits = tree[tree[n * 2 + 1] * 2 + 1] + 1;
      if (bits > max_length) {
        bits = max_length;
        overflow++;
      }
      tree[n * 2 + 1] = bits;
      if (n > max_code) {
        continue;
      }
      s.bl_count[bits]++;
      xbits = 0;
      if (n >= base) {
        xbits = extra[n - base];
      }
      f = tree[n * 2];
      s.opt_len += f * (bits + xbits);
      if (has_stree) {
        s.static_len += f * (stree[n * 2 + 1] + xbits);
      }
    }
    if (overflow === 0) {
      return;
    }
    do {
      bits = max_length - 1;
      while (s.bl_count[bits] === 0) {
        bits--;
      }
      s.bl_count[bits]--;
      s.bl_count[bits + 1] += 2;
      s.bl_count[max_length]--;
      overflow -= 2;
    } while (overflow > 0);
    for (bits = max_length;bits !== 0; bits--) {
      n = s.bl_count[bits];
      while (n !== 0) {
        m = s.heap[--h];
        if (m > max_code) {
          continue;
        }
        if (tree[m * 2 + 1] !== bits) {
          s.opt_len += (bits - tree[m * 2 + 1]) * tree[m * 2];
          tree[m * 2 + 1] = bits;
        }
        n--;
      }
    }
  }
  function gen_codes(tree, max_code, bl_count) {
    var next_code = new Array(MAX_BITS + 1);
    var code2 = 0;
    var bits;
    var n;
    for (bits = 1;bits <= MAX_BITS; bits++) {
      next_code[bits] = code2 = code2 + bl_count[bits - 1] << 1;
    }
    for (n = 0;n <= max_code; n++) {
      var len2 = tree[n * 2 + 1];
      if (len2 === 0) {
        continue;
      }
      tree[n * 2] = bi_reverse(next_code[len2]++, len2);
    }
  }
  function tr_static_init() {
    var n;
    var bits;
    var length;
    var code2;
    var dist;
    var bl_count = new Array(MAX_BITS + 1);
    length = 0;
    for (code2 = 0;code2 < LENGTH_CODES - 1; code2++) {
      base_length[code2] = length;
      for (n = 0;n < 1 << extra_lbits[code2]; n++) {
        _length_code[length++] = code2;
      }
    }
    _length_code[length - 1] = code2;
    dist = 0;
    for (code2 = 0;code2 < 16; code2++) {
      base_dist[code2] = dist;
      for (n = 0;n < 1 << extra_dbits[code2]; n++) {
        _dist_code[dist++] = code2;
      }
    }
    dist >>= 7;
    for (;code2 < D_CODES; code2++) {
      base_dist[code2] = dist << 7;
      for (n = 0;n < 1 << extra_dbits[code2] - 7; n++) {
        _dist_code[256 + dist++] = code2;
      }
    }
    for (bits = 0;bits <= MAX_BITS; bits++) {
      bl_count[bits] = 0;
    }
    n = 0;
    while (n <= 143) {
      static_ltree[n * 2 + 1] = 8;
      n++;
      bl_count[8]++;
    }
    while (n <= 255) {
      static_ltree[n * 2 + 1] = 9;
      n++;
      bl_count[9]++;
    }
    while (n <= 279) {
      static_ltree[n * 2 + 1] = 7;
      n++;
      bl_count[7]++;
    }
    while (n <= 287) {
      static_ltree[n * 2 + 1] = 8;
      n++;
      bl_count[8]++;
    }
    gen_codes(static_ltree, L_CODES + 1, bl_count);
    for (n = 0;n < D_CODES; n++) {
      static_dtree[n * 2 + 1] = 5;
      static_dtree[n * 2] = bi_reverse(n, 5);
    }
    static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS + 1, L_CODES, MAX_BITS);
    static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES, MAX_BITS);
    static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES, MAX_BL_BITS);
  }
  function init_block(s) {
    var n;
    for (n = 0;n < L_CODES; n++) {
      s.dyn_ltree[n * 2] = 0;
    }
    for (n = 0;n < D_CODES; n++) {
      s.dyn_dtree[n * 2] = 0;
    }
    for (n = 0;n < BL_CODES; n++) {
      s.bl_tree[n * 2] = 0;
    }
    s.dyn_ltree[END_BLOCK * 2] = 1;
    s.opt_len = s.static_len = 0;
    s.last_lit = s.matches = 0;
  }
  function bi_windup(s) {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
      s.pending_buf[s.pending++] = s.bi_buf;
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
  }
  function copy_block(s, buf, len2, header) {
    bi_windup(s);
    if (header) {
      put_short(s, len2);
      put_short(s, ~len2);
    }
    utils.arraySet(s.pending_buf, s.window, buf, len2, s.pending);
    s.pending += len2;
  }
  function smaller(tree, n, m, depth) {
    var _n2 = n * 2;
    var _m2 = m * 2;
    return tree[_n2] < tree[_m2] || tree[_n2] === tree[_m2] && depth[n] <= depth[m];
  }
  function pqdownheap(s, tree, k) {
    var v = s.heap[k];
    var j = k << 1;
    while (j <= s.heap_len) {
      if (j < s.heap_len && smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++;
      }
      if (smaller(tree, v, s.heap[j], s.depth)) {
        break;
      }
      s.heap[k] = s.heap[j];
      k = j;
      j <<= 1;
    }
    s.heap[k] = v;
  }
  function compress_block(s, ltree, dtree) {
    var dist;
    var lc;
    var lx = 0;
    var code2;
    var extra;
    if (s.last_lit !== 0) {
      do {
        dist = s.pending_buf[s.d_buf + lx * 2] << 8 | s.pending_buf[s.d_buf + lx * 2 + 1];
        lc = s.pending_buf[s.l_buf + lx];
        lx++;
        if (dist === 0) {
          send_code(s, lc, ltree);
        } else {
          code2 = _length_code[lc];
          send_code(s, code2 + LITERALS + 1, ltree);
          extra = extra_lbits[code2];
          if (extra !== 0) {
            lc -= base_length[code2];
            send_bits(s, lc, extra);
          }
          dist--;
          code2 = d_code(dist);
          send_code(s, code2, dtree);
          extra = extra_dbits[code2];
          if (extra !== 0) {
            dist -= base_dist[code2];
            send_bits(s, dist, extra);
          }
        }
      } while (lx < s.last_lit);
    }
    send_code(s, END_BLOCK, ltree);
  }
  function build_tree(s, desc) {
    var tree = desc.dyn_tree;
    var stree = desc.stat_desc.static_tree;
    var has_stree = desc.stat_desc.has_stree;
    var elems = desc.stat_desc.elems;
    var n, m;
    var max_code = -1;
    var node;
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE;
    for (n = 0;n < elems; n++) {
      if (tree[n * 2] !== 0) {
        s.heap[++s.heap_len] = max_code = n;
        s.depth[n] = 0;
      } else {
        tree[n * 2 + 1] = 0;
      }
    }
    while (s.heap_len < 2) {
      node = s.heap[++s.heap_len] = max_code < 2 ? ++max_code : 0;
      tree[node * 2] = 1;
      s.depth[node] = 0;
      s.opt_len--;
      if (has_stree) {
        s.static_len -= stree[node * 2 + 1];
      }
    }
    desc.max_code = max_code;
    for (n = s.heap_len >> 1;n >= 1; n--) {
      pqdownheap(s, tree, n);
    }
    node = elems;
    do {
      n = s.heap[1];
      s.heap[1] = s.heap[s.heap_len--];
      pqdownheap(s, tree, 1);
      m = s.heap[1];
      s.heap[--s.heap_max] = n;
      s.heap[--s.heap_max] = m;
      tree[node * 2] = tree[n * 2] + tree[m * 2];
      s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
      tree[n * 2 + 1] = tree[m * 2 + 1] = node;
      s.heap[1] = node++;
      pqdownheap(s, tree, 1);
    } while (s.heap_len >= 2);
    s.heap[--s.heap_max] = s.heap[1];
    gen_bitlen(s, desc);
    gen_codes(tree, max_code, s.bl_count);
  }
  function scan_tree(s, tree, max_code) {
    var n;
    var prevlen = -1;
    var curlen;
    var nextlen = tree[0 * 2 + 1];
    var count = 0;
    var max_count = 7;
    var min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    tree[(max_code + 1) * 2 + 1] = 65535;
    for (n = 0;n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1];
      if (++count < max_count && curlen === nextlen) {
        continue;
      } else if (count < min_count) {
        s.bl_tree[curlen * 2] += count;
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          s.bl_tree[curlen * 2]++;
        }
        s.bl_tree[REP_3_6 * 2]++;
      } else if (count <= 10) {
        s.bl_tree[REPZ_3_10 * 2]++;
      } else {
        s.bl_tree[REPZ_11_138 * 2]++;
      }
      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }
  function send_tree(s, tree, max_code) {
    var n;
    var prevlen = -1;
    var curlen;
    var nextlen = tree[0 * 2 + 1];
    var count = 0;
    var max_count = 7;
    var min_count = 4;
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    for (n = 0;n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1];
      if (++count < max_count && curlen === nextlen) {
        continue;
      } else if (count < min_count) {
        do {
          send_code(s, curlen, s.bl_tree);
        } while (--count !== 0);
      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree);
          count--;
        }
        send_code(s, REP_3_6, s.bl_tree);
        send_bits(s, count - 3, 2);
      } else if (count <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree);
        send_bits(s, count - 3, 3);
      } else {
        send_code(s, REPZ_11_138, s.bl_tree);
        send_bits(s, count - 11, 7);
      }
      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;
      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;
      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }
  function build_bl_tree(s) {
    var max_blindex;
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);
    build_tree(s, s.bl_desc);
    for (max_blindex = BL_CODES - 1;max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1] !== 0) {
        break;
      }
    }
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    return max_blindex;
  }
  function send_all_trees(s, lcodes, dcodes, blcodes) {
    var rank;
    send_bits(s, lcodes - 257, 5);
    send_bits(s, dcodes - 1, 5);
    send_bits(s, blcodes - 4, 4);
    for (rank = 0;rank < blcodes; rank++) {
      send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1], 3);
    }
    send_tree(s, s.dyn_ltree, lcodes - 1);
    send_tree(s, s.dyn_dtree, dcodes - 1);
  }
  function detect_data_type(s) {
    var black_mask = 4093624447;
    var n;
    for (n = 0;n <= 31; n++, black_mask >>>= 1) {
      if (black_mask & 1 && s.dyn_ltree[n * 2] !== 0) {
        return Z_BINARY;
      }
    }
    if (s.dyn_ltree[9 * 2] !== 0 || s.dyn_ltree[10 * 2] !== 0 || s.dyn_ltree[13 * 2] !== 0) {
      return Z_TEXT;
    }
    for (n = 32;n < LITERALS; n++) {
      if (s.dyn_ltree[n * 2] !== 0) {
        return Z_TEXT;
      }
    }
    return Z_BINARY;
  }
  var static_init_done = false;
  function _tr_init(s) {
    if (!static_init_done) {
      tr_static_init();
      static_init_done = true;
    }
    s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
    s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);
    s.bi_buf = 0;
    s.bi_valid = 0;
    init_block(s);
  }
  function _tr_stored_block(s, buf, stored_len, last) {
    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3);
    copy_block(s, buf, stored_len, true);
  }
  function _tr_align(s) {
    send_bits(s, STATIC_TREES << 1, 3);
    send_code(s, END_BLOCK, static_ltree);
    bi_flush(s);
  }
  function _tr_flush_block(s, buf, stored_len, last) {
    var opt_lenb, static_lenb;
    var max_blindex = 0;
    if (s.level > 0) {
      if (s.strm.data_type === Z_UNKNOWN) {
        s.strm.data_type = detect_data_type(s);
      }
      build_tree(s, s.l_desc);
      build_tree(s, s.d_desc);
      max_blindex = build_bl_tree(s);
      opt_lenb = s.opt_len + 3 + 7 >>> 3;
      static_lenb = s.static_len + 3 + 7 >>> 3;
      if (static_lenb <= opt_lenb) {
        opt_lenb = static_lenb;
      }
    } else {
      opt_lenb = static_lenb = stored_len + 5;
    }
    if (stored_len + 4 <= opt_lenb && buf !== -1) {
      _tr_stored_block(s, buf, stored_len, last);
    } else if (s.strategy === Z_FIXED || static_lenb === opt_lenb) {
      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
      compress_block(s, static_ltree, static_dtree);
    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
      send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
      compress_block(s, s.dyn_ltree, s.dyn_dtree);
    }
    init_block(s);
    if (last) {
      bi_windup(s);
    }
  }
  function _tr_tally(s, dist, lc) {
    s.pending_buf[s.d_buf + s.last_lit * 2] = dist >>> 8 & 255;
    s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 255;
    s.pending_buf[s.l_buf + s.last_lit] = lc & 255;
    s.last_lit++;
    if (dist === 0) {
      s.dyn_ltree[lc * 2]++;
    } else {
      s.matches++;
      dist--;
      s.dyn_ltree[(_length_code[lc] + LITERALS + 1) * 2]++;
      s.dyn_dtree[d_code(dist) * 2]++;
    }
    return s.last_lit === s.lit_bufsize - 1;
  }
  exports._tr_init = _tr_init;
  exports._tr_stored_block = _tr_stored_block;
  exports._tr_flush_block = _tr_flush_block;
  exports._tr_tally = _tr_tally;
  exports._tr_align = _tr_align;
});

// node_modules/pako/lib/zlib/adler32.js
var require_adler32 = __commonJS((exports, module) => {
  function adler32(adler, buf, len2, pos) {
    var s1 = adler & 65535 | 0, s2 = adler >>> 16 & 65535 | 0, n = 0;
    while (len2 !== 0) {
      n = len2 > 2000 ? 2000 : len2;
      len2 -= n;
      do {
        s1 = s1 + buf[pos++] | 0;
        s2 = s2 + s1 | 0;
      } while (--n);
      s1 %= 65521;
      s2 %= 65521;
    }
    return s1 | s2 << 16 | 0;
  }
  module.exports = adler32;
});

// node_modules/pako/lib/zlib/crc32.js
var require_crc322 = __commonJS((exports, module) => {
  function makeTable() {
    var c, table = [];
    for (var n = 0;n < 256; n++) {
      c = n;
      for (var k = 0;k < 8; k++) {
        c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
      }
      table[n] = c;
    }
    return table;
  }
  var crcTable = makeTable();
  function crc32(crc, buf, len2, pos) {
    var t = crcTable, end = pos + len2;
    crc ^= -1;
    for (var i2 = pos;i2 < end; i2++) {
      crc = crc >>> 8 ^ t[(crc ^ buf[i2]) & 255];
    }
    return crc ^ -1;
  }
  module.exports = crc32;
});

// node_modules/pako/lib/zlib/messages.js
var require_messages = __commonJS((exports, module) => {
  module.exports = {
    2: "need dictionary",
    1: "stream end",
    0: "",
    "-1": "file error",
    "-2": "stream error",
    "-3": "data error",
    "-4": "insufficient memory",
    "-5": "buffer error",
    "-6": "incompatible version"
  };
});

// node_modules/pako/lib/zlib/deflate.js
var require_deflate = __commonJS((exports) => {
  var utils = require_common();
  var trees = require_trees();
  var adler32 = require_adler32();
  var crc32 = require_crc322();
  var msg = require_messages();
  var Z_NO_FLUSH = 0;
  var Z_PARTIAL_FLUSH = 1;
  var Z_FULL_FLUSH = 3;
  var Z_FINISH = 4;
  var Z_BLOCK = 5;
  var Z_OK = 0;
  var Z_STREAM_END = 1;
  var Z_STREAM_ERROR = -2;
  var Z_DATA_ERROR = -3;
  var Z_BUF_ERROR = -5;
  var Z_DEFAULT_COMPRESSION = -1;
  var Z_FILTERED = 1;
  var Z_HUFFMAN_ONLY = 2;
  var Z_RLE = 3;
  var Z_FIXED = 4;
  var Z_DEFAULT_STRATEGY = 0;
  var Z_UNKNOWN = 2;
  var Z_DEFLATED = 8;
  var MAX_MEM_LEVEL = 9;
  var MAX_WBITS = 15;
  var DEF_MEM_LEVEL = 8;
  var LENGTH_CODES = 29;
  var LITERALS = 256;
  var L_CODES = LITERALS + 1 + LENGTH_CODES;
  var D_CODES = 30;
  var BL_CODES = 19;
  var HEAP_SIZE = 2 * L_CODES + 1;
  var MAX_BITS = 15;
  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var MIN_LOOKAHEAD = MAX_MATCH + MIN_MATCH + 1;
  var PRESET_DICT = 32;
  var INIT_STATE = 42;
  var EXTRA_STATE = 69;
  var NAME_STATE = 73;
  var COMMENT_STATE = 91;
  var HCRC_STATE = 103;
  var BUSY_STATE = 113;
  var FINISH_STATE = 666;
  var BS_NEED_MORE = 1;
  var BS_BLOCK_DONE = 2;
  var BS_FINISH_STARTED = 3;
  var BS_FINISH_DONE = 4;
  var OS_CODE = 3;
  function err(strm, errorCode) {
    strm.msg = msg[errorCode];
    return errorCode;
  }
  function rank(f) {
    return (f << 1) - (f > 4 ? 9 : 0);
  }
  function zero(buf) {
    var len2 = buf.length;
    while (--len2 >= 0) {
      buf[len2] = 0;
    }
  }
  function flush_pending(strm) {
    var s = strm.state;
    var len2 = s.pending;
    if (len2 > strm.avail_out) {
      len2 = strm.avail_out;
    }
    if (len2 === 0) {
      return;
    }
    utils.arraySet(strm.output, s.pending_buf, s.pending_out, len2, strm.next_out);
    strm.next_out += len2;
    s.pending_out += len2;
    strm.total_out += len2;
    strm.avail_out -= len2;
    s.pending -= len2;
    if (s.pending === 0) {
      s.pending_out = 0;
    }
  }
  function flush_block_only(s, last) {
    trees._tr_flush_block(s, s.block_start >= 0 ? s.block_start : -1, s.strstart - s.block_start, last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
  }
  function put_byte(s, b) {
    s.pending_buf[s.pending++] = b;
  }
  function putShortMSB(s, b) {
    s.pending_buf[s.pending++] = b >>> 8 & 255;
    s.pending_buf[s.pending++] = b & 255;
  }
  function read_buf(strm, buf, start, size) {
    var len2 = strm.avail_in;
    if (len2 > size) {
      len2 = size;
    }
    if (len2 === 0) {
      return 0;
    }
    strm.avail_in -= len2;
    utils.arraySet(buf, strm.input, strm.next_in, len2, start);
    if (strm.state.wrap === 1) {
      strm.adler = adler32(strm.adler, buf, len2, start);
    } else if (strm.state.wrap === 2) {
      strm.adler = crc32(strm.adler, buf, len2, start);
    }
    strm.next_in += len2;
    strm.total_in += len2;
    return len2;
  }
  function longest_match(s, cur_match) {
    var chain_length = s.max_chain_length;
    var scan = s.strstart;
    var match;
    var len2;
    var best_len = s.prev_length;
    var nice_match = s.nice_match;
    var limit = s.strstart > s.w_size - MIN_LOOKAHEAD ? s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0;
    var _win = s.window;
    var wmask = s.w_mask;
    var prev = s.prev;
    var strend = s.strstart + MAX_MATCH;
    var scan_end1 = _win[scan + best_len - 1];
    var scan_end = _win[scan + best_len];
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2;
    }
    if (nice_match > s.lookahead) {
      nice_match = s.lookahead;
    }
    do {
      match = cur_match;
      if (_win[match + best_len] !== scan_end || _win[match + best_len - 1] !== scan_end1 || _win[match] !== _win[scan] || _win[++match] !== _win[scan + 1]) {
        continue;
      }
      scan += 2;
      match++;
      do {} while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && _win[++scan] === _win[++match] && scan < strend);
      len2 = MAX_MATCH - (strend - scan);
      scan = strend - MAX_MATCH;
      if (len2 > best_len) {
        s.match_start = cur_match;
        best_len = len2;
        if (len2 >= nice_match) {
          break;
        }
        scan_end1 = _win[scan + best_len - 1];
        scan_end = _win[scan + best_len];
      }
    } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);
    if (best_len <= s.lookahead) {
      return best_len;
    }
    return s.lookahead;
  }
  function fill_window(s) {
    var _w_size = s.w_size;
    var p, n, m, more, str;
    do {
      more = s.window_size - s.lookahead - s.strstart;
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {
        utils.arraySet(s.window, s.window, _w_size, _w_size, 0);
        s.match_start -= _w_size;
        s.strstart -= _w_size;
        s.block_start -= _w_size;
        n = s.hash_size;
        p = n;
        do {
          m = s.head[--p];
          s.head[p] = m >= _w_size ? m - _w_size : 0;
        } while (--n);
        n = _w_size;
        p = n;
        do {
          m = s.prev[--p];
          s.prev[p] = m >= _w_size ? m - _w_size : 0;
        } while (--n);
        more += _w_size;
      }
      if (s.strm.avail_in === 0) {
        break;
      }
      n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
      s.lookahead += n;
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert;
        s.ins_h = s.window[str];
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + 1]) & s.hash_mask;
        while (s.insert) {
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
          s.insert--;
          if (s.lookahead + s.insert < MIN_MATCH) {
            break;
          }
        }
      }
    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);
  }
  function deflate_stored(s, flush) {
    var max_block_size = 65535;
    if (max_block_size > s.pending_buf_size - 5) {
      max_block_size = s.pending_buf_size - 5;
    }
    for (;; ) {
      if (s.lookahead <= 1) {
        fill_window(s);
        if (s.lookahead === 0 && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      s.strstart += s.lookahead;
      s.lookahead = 0;
      var max_start = s.block_start + max_block_size;
      if (s.strstart === 0 || s.strstart >= max_start) {
        s.lookahead = s.strstart - max_start;
        s.strstart = max_start;
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
      if (s.strstart - s.block_start >= s.w_size - MIN_LOOKAHEAD) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.strstart > s.block_start) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_NEED_MORE;
  }
  function deflate_fast(s, flush) {
    var hash_head;
    var bflush;
    for (;; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      if (hash_head !== 0 && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = trees._tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        if (s.match_length <= s.max_lazy_match && s.lookahead >= MIN_MATCH) {
          s.match_length--;
          do {
            s.strstart++;
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          } while (--s.match_length !== 0);
          s.strstart++;
        } else {
          s.strstart += s.match_length;
          s.match_length = 0;
          s.ins_h = s.window[s.strstart];
          s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + 1]) & s.hash_mask;
        }
      } else {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }
  function deflate_slow(s, flush) {
    var hash_head;
    var bflush;
    var max_insert;
    for (;; ) {
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      hash_head = 0;
      if (s.lookahead >= MIN_MATCH) {
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
      }
      s.prev_length = s.match_length;
      s.prev_match = s.match_start;
      s.match_length = MIN_MATCH - 1;
      if (hash_head !== 0 && s.prev_length < s.max_lazy_match && s.strstart - hash_head <= s.w_size - MIN_LOOKAHEAD) {
        s.match_length = longest_match(s, hash_head);
        if (s.match_length <= 5 && (s.strategy === Z_FILTERED || s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096)) {
          s.match_length = MIN_MATCH - 1;
        }
      }
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH;
        bflush = trees._tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
        s.lookahead -= s.prev_length - 1;
        s.prev_length -= 2;
        do {
          if (++s.strstart <= max_insert) {
            s.ins_h = (s.ins_h << s.hash_shift ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
          }
        } while (--s.prev_length !== 0);
        s.match_available = 0;
        s.match_length = MIN_MATCH - 1;
        s.strstart++;
        if (bflush) {
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
        }
      } else if (s.match_available) {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
        if (bflush) {
          flush_block_only(s, false);
        }
        s.strstart++;
        s.lookahead--;
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      } else {
        s.match_available = 1;
        s.strstart++;
        s.lookahead--;
      }
    }
    if (s.match_available) {
      bflush = trees._tr_tally(s, 0, s.window[s.strstart - 1]);
      s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }
  function deflate_rle(s, flush) {
    var bflush;
    var prev;
    var scan, strend;
    var _win = s.window;
    for (;; ) {
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s);
        if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        }
      }
      s.match_length = 0;
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1;
        prev = _win[scan];
        if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
          strend = s.strstart + MAX_MATCH;
          do {} while (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan] && scan < strend);
          s.match_length = MAX_MATCH - (strend - scan);
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead;
          }
        }
      }
      if (s.match_length >= MIN_MATCH) {
        bflush = trees._tr_tally(s, 1, s.match_length - MIN_MATCH);
        s.lookahead -= s.match_length;
        s.strstart += s.match_length;
        s.match_length = 0;
      } else {
        bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }
  function deflate_huff(s, flush) {
    var bflush;
    for (;; ) {
      if (s.lookahead === 0) {
        fill_window(s);
        if (s.lookahead === 0) {
          if (flush === Z_NO_FLUSH) {
            return BS_NEED_MORE;
          }
          break;
        }
      }
      s.match_length = 0;
      bflush = trees._tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
      if (bflush) {
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH) {
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
    }
    return BS_BLOCK_DONE;
  }
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }
  var configuration_table;
  configuration_table = [
    new Config(0, 0, 0, 0, deflate_stored),
    new Config(4, 4, 8, 4, deflate_fast),
    new Config(4, 5, 16, 8, deflate_fast),
    new Config(4, 6, 32, 32, deflate_fast),
    new Config(4, 4, 16, 16, deflate_slow),
    new Config(8, 16, 32, 32, deflate_slow),
    new Config(8, 16, 128, 128, deflate_slow),
    new Config(8, 32, 128, 256, deflate_slow),
    new Config(32, 128, 258, 1024, deflate_slow),
    new Config(32, 258, 258, 4096, deflate_slow)
  ];
  function lm_init(s) {
    s.window_size = 2 * s.w_size;
    zero(s.head);
    s.max_lazy_match = configuration_table[s.level].max_lazy;
    s.good_match = configuration_table[s.level].good_length;
    s.nice_match = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;
    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    s.ins_h = 0;
  }
  function DeflateState() {
    this.strm = null;
    this.status = 0;
    this.pending_buf = null;
    this.pending_buf_size = 0;
    this.pending_out = 0;
    this.pending = 0;
    this.wrap = 0;
    this.gzhead = null;
    this.gzindex = 0;
    this.method = Z_DEFLATED;
    this.last_flush = -1;
    this.w_size = 0;
    this.w_bits = 0;
    this.w_mask = 0;
    this.window = null;
    this.window_size = 0;
    this.prev = null;
    this.head = null;
    this.ins_h = 0;
    this.hash_size = 0;
    this.hash_bits = 0;
    this.hash_mask = 0;
    this.hash_shift = 0;
    this.block_start = 0;
    this.match_length = 0;
    this.prev_match = 0;
    this.match_available = 0;
    this.strstart = 0;
    this.match_start = 0;
    this.lookahead = 0;
    this.prev_length = 0;
    this.max_chain_length = 0;
    this.max_lazy_match = 0;
    this.level = 0;
    this.strategy = 0;
    this.good_match = 0;
    this.nice_match = 0;
    this.dyn_ltree = new utils.Buf16(HEAP_SIZE * 2);
    this.dyn_dtree = new utils.Buf16((2 * D_CODES + 1) * 2);
    this.bl_tree = new utils.Buf16((2 * BL_CODES + 1) * 2);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);
    this.l_desc = null;
    this.d_desc = null;
    this.bl_desc = null;
    this.bl_count = new utils.Buf16(MAX_BITS + 1);
    this.heap = new utils.Buf16(2 * L_CODES + 1);
    zero(this.heap);
    this.heap_len = 0;
    this.heap_max = 0;
    this.depth = new utils.Buf16(2 * L_CODES + 1);
    zero(this.depth);
    this.l_buf = 0;
    this.lit_bufsize = 0;
    this.last_lit = 0;
    this.d_buf = 0;
    this.opt_len = 0;
    this.static_len = 0;
    this.matches = 0;
    this.insert = 0;
    this.bi_buf = 0;
    this.bi_valid = 0;
  }
  function deflateResetKeep(strm) {
    var s;
    if (!strm || !strm.state) {
      return err(strm, Z_STREAM_ERROR);
    }
    strm.total_in = strm.total_out = 0;
    strm.data_type = Z_UNKNOWN;
    s = strm.state;
    s.pending = 0;
    s.pending_out = 0;
    if (s.wrap < 0) {
      s.wrap = -s.wrap;
    }
    s.status = s.wrap ? INIT_STATE : BUSY_STATE;
    strm.adler = s.wrap === 2 ? 0 : 1;
    s.last_flush = Z_NO_FLUSH;
    trees._tr_init(s);
    return Z_OK;
  }
  function deflateReset(strm) {
    var ret = deflateResetKeep(strm);
    if (ret === Z_OK) {
      lm_init(strm.state);
    }
    return ret;
  }
  function deflateSetHeader(strm, head) {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    if (strm.state.wrap !== 2) {
      return Z_STREAM_ERROR;
    }
    strm.state.gzhead = head;
    return Z_OK;
  }
  function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
    if (!strm) {
      return Z_STREAM_ERROR;
    }
    var wrap = 1;
    if (level === Z_DEFAULT_COMPRESSION) {
      level = 6;
    }
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else if (windowBits > 15) {
      wrap = 2;
      windowBits -= 16;
    }
    if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED || windowBits < 8 || windowBits > 15 || level < 0 || level > 9 || strategy < 0 || strategy > Z_FIXED) {
      return err(strm, Z_STREAM_ERROR);
    }
    if (windowBits === 8) {
      windowBits = 9;
    }
    var s = new DeflateState;
    strm.state = s;
    s.strm = strm;
    s.wrap = wrap;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;
    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);
    s.window = new utils.Buf8(s.w_size * 2);
    s.head = new utils.Buf16(s.hash_size);
    s.prev = new utils.Buf16(s.w_size);
    s.lit_bufsize = 1 << memLevel + 6;
    s.pending_buf_size = s.lit_bufsize * 4;
    s.pending_buf = new utils.Buf8(s.pending_buf_size);
    s.d_buf = 1 * s.lit_bufsize;
    s.l_buf = (1 + 2) * s.lit_bufsize;
    s.level = level;
    s.strategy = strategy;
    s.method = method;
    return deflateReset(strm);
  }
  function deflateInit(strm, level) {
    return deflateInit2(strm, level, Z_DEFLATED, MAX_WBITS, DEF_MEM_LEVEL, Z_DEFAULT_STRATEGY);
  }
  function deflate(strm, flush) {
    var old_flush, s;
    var beg, val;
    if (!strm || !strm.state || flush > Z_BLOCK || flush < 0) {
      return strm ? err(strm, Z_STREAM_ERROR) : Z_STREAM_ERROR;
    }
    s = strm.state;
    if (!strm.output || !strm.input && strm.avail_in !== 0 || s.status === FINISH_STATE && flush !== Z_FINISH) {
      return err(strm, strm.avail_out === 0 ? Z_BUF_ERROR : Z_STREAM_ERROR);
    }
    s.strm = strm;
    old_flush = s.last_flush;
    s.last_flush = flush;
    if (s.status === INIT_STATE) {
      if (s.wrap === 2) {
        strm.adler = 0;
        put_byte(s, 31);
        put_byte(s, 139);
        put_byte(s, 8);
        if (!s.gzhead) {
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
          put_byte(s, OS_CODE);
          s.status = BUSY_STATE;
        } else {
          put_byte(s, (s.gzhead.text ? 1 : 0) + (s.gzhead.hcrc ? 2 : 0) + (!s.gzhead.extra ? 0 : 4) + (!s.gzhead.name ? 0 : 8) + (!s.gzhead.comment ? 0 : 16));
          put_byte(s, s.gzhead.time & 255);
          put_byte(s, s.gzhead.time >> 8 & 255);
          put_byte(s, s.gzhead.time >> 16 & 255);
          put_byte(s, s.gzhead.time >> 24 & 255);
          put_byte(s, s.level === 9 ? 2 : s.strategy >= Z_HUFFMAN_ONLY || s.level < 2 ? 4 : 0);
          put_byte(s, s.gzhead.os & 255);
          if (s.gzhead.extra && s.gzhead.extra.length) {
            put_byte(s, s.gzhead.extra.length & 255);
            put_byte(s, s.gzhead.extra.length >> 8 & 255);
          }
          if (s.gzhead.hcrc) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
          }
          s.gzindex = 0;
          s.status = EXTRA_STATE;
        }
      } else {
        var header = Z_DEFLATED + (s.w_bits - 8 << 4) << 8;
        var level_flags = -1;
        if (s.strategy >= Z_HUFFMAN_ONLY || s.level < 2) {
          level_flags = 0;
        } else if (s.level < 6) {
          level_flags = 1;
        } else if (s.level === 6) {
          level_flags = 2;
        } else {
          level_flags = 3;
        }
        header |= level_flags << 6;
        if (s.strstart !== 0) {
          header |= PRESET_DICT;
        }
        header += 31 - header % 31;
        s.status = BUSY_STATE;
        putShortMSB(s, header);
        if (s.strstart !== 0) {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 65535);
        }
        strm.adler = 1;
      }
    }
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra) {
        beg = s.pending;
        while (s.gzindex < (s.gzhead.extra.length & 65535)) {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              break;
            }
          }
          put_byte(s, s.gzhead.extra[s.gzindex] & 255);
          s.gzindex++;
        }
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (s.gzindex === s.gzhead.extra.length) {
          s.gzindex = 0;
          s.status = NAME_STATE;
        }
      } else {
        s.status = NAME_STATE;
      }
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name) {
        beg = s.pending;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.gzindex = 0;
          s.status = COMMENT_STATE;
        }
      } else {
        s.status = COMMENT_STATE;
      }
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment) {
        beg = s.pending;
        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 255;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.status = HCRC_STATE;
        }
      } else {
        s.status = HCRC_STATE;
      }
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm);
        }
        if (s.pending + 2 <= s.pending_buf_size) {
          put_byte(s, strm.adler & 255);
          put_byte(s, strm.adler >> 8 & 255);
          strm.adler = 0;
          s.status = BUSY_STATE;
        }
      } else {
        s.status = BUSY_STATE;
      }
    }
    if (s.pending !== 0) {
      flush_pending(strm);
      if (strm.avail_out === 0) {
        s.last_flush = -1;
        return Z_OK;
      }
    } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) && flush !== Z_FINISH) {
      return err(strm, Z_BUF_ERROR);
    }
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR);
    }
    if (strm.avail_in !== 0 || s.lookahead !== 0 || flush !== Z_NO_FLUSH && s.status !== FINISH_STATE) {
      var bstate = s.strategy === Z_HUFFMAN_ONLY ? deflate_huff(s, flush) : s.strategy === Z_RLE ? deflate_rle(s, flush) : configuration_table[s.level].func(s, flush);
      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE;
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1;
        }
        return Z_OK;
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush === Z_PARTIAL_FLUSH) {
          trees._tr_align(s);
        } else if (flush !== Z_BLOCK) {
          trees._tr_stored_block(s, 0, 0, false);
          if (flush === Z_FULL_FLUSH) {
            zero(s.head);
            if (s.lookahead === 0) {
              s.strstart = 0;
              s.block_start = 0;
              s.insert = 0;
            }
          }
        }
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          return Z_OK;
        }
      }
    }
    if (flush !== Z_FINISH) {
      return Z_OK;
    }
    if (s.wrap <= 0) {
      return Z_STREAM_END;
    }
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 255);
      put_byte(s, strm.adler >> 8 & 255);
      put_byte(s, strm.adler >> 16 & 255);
      put_byte(s, strm.adler >> 24 & 255);
      put_byte(s, strm.total_in & 255);
      put_byte(s, strm.total_in >> 8 & 255);
      put_byte(s, strm.total_in >> 16 & 255);
      put_byte(s, strm.total_in >> 24 & 255);
    } else {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 65535);
    }
    flush_pending(strm);
    if (s.wrap > 0) {
      s.wrap = -s.wrap;
    }
    return s.pending !== 0 ? Z_OK : Z_STREAM_END;
  }
  function deflateEnd(strm) {
    var status;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    status = strm.state.status;
    if (status !== INIT_STATE && status !== EXTRA_STATE && status !== NAME_STATE && status !== COMMENT_STATE && status !== HCRC_STATE && status !== BUSY_STATE && status !== FINISH_STATE) {
      return err(strm, Z_STREAM_ERROR);
    }
    strm.state = null;
    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR) : Z_OK;
  }
  function deflateSetDictionary(strm, dictionary) {
    var dictLength = dictionary.length;
    var s;
    var str, n;
    var wrap;
    var avail;
    var next;
    var input;
    var tmpDict;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    s = strm.state;
    wrap = s.wrap;
    if (wrap === 2 || wrap === 1 && s.status !== INIT_STATE || s.lookahead) {
      return Z_STREAM_ERROR;
    }
    if (wrap === 1) {
      strm.adler = adler32(strm.adler, dictionary, dictLength, 0);
    }
    s.wrap = 0;
    if (dictLength >= s.w_size) {
      if (wrap === 0) {
        zero(s.head);
        s.strstart = 0;
        s.block_start = 0;
        s.insert = 0;
      }
      tmpDict = new utils.Buf8(s.w_size);
      utils.arraySet(tmpDict, dictionary, dictLength - s.w_size, s.w_size, 0);
      dictionary = tmpDict;
      dictLength = s.w_size;
    }
    avail = strm.avail_in;
    next = strm.next_in;
    input = strm.input;
    strm.avail_in = dictLength;
    strm.next_in = 0;
    strm.input = dictionary;
    fill_window(s);
    while (s.lookahead >= MIN_MATCH) {
      str = s.strstart;
      n = s.lookahead - (MIN_MATCH - 1);
      do {
        s.ins_h = (s.ins_h << s.hash_shift ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;
        s.prev[str & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = str;
        str++;
      } while (--n);
      s.strstart = str;
      s.lookahead = MIN_MATCH - 1;
      fill_window(s);
    }
    s.strstart += s.lookahead;
    s.block_start = s.strstart;
    s.insert = s.lookahead;
    s.lookahead = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    strm.next_in = next;
    strm.input = input;
    strm.avail_in = avail;
    s.wrap = wrap;
    return Z_OK;
  }
  exports.deflateInit = deflateInit;
  exports.deflateInit2 = deflateInit2;
  exports.deflateReset = deflateReset;
  exports.deflateResetKeep = deflateResetKeep;
  exports.deflateSetHeader = deflateSetHeader;
  exports.deflate = deflate;
  exports.deflateEnd = deflateEnd;
  exports.deflateSetDictionary = deflateSetDictionary;
  exports.deflateInfo = "pako deflate (from Nodeca project)";
});

// node_modules/pako/lib/utils/strings.js
var require_strings = __commonJS((exports) => {
  var utils = require_common();
  var STR_APPLY_OK = true;
  var STR_APPLY_UIA_OK = true;
  try {
    String.fromCharCode.apply(null, [0]);
  } catch (__) {
    STR_APPLY_OK = false;
  }
  try {
    String.fromCharCode.apply(null, new Uint8Array(1));
  } catch (__) {
    STR_APPLY_UIA_OK = false;
  }
  var _utf8len = new utils.Buf8(256);
  for (q = 0;q < 256; q++) {
    _utf8len[q] = q >= 252 ? 6 : q >= 248 ? 5 : q >= 240 ? 4 : q >= 224 ? 3 : q >= 192 ? 2 : 1;
  }
  var q;
  _utf8len[254] = _utf8len[254] = 1;
  exports.string2buf = function(str) {
    var buf, c, c2, m_pos, i2, str_len = str.length, buf_len = 0;
    for (m_pos = 0;m_pos < str_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      buf_len += c < 128 ? 1 : c < 2048 ? 2 : c < 65536 ? 3 : 4;
    }
    buf = new utils.Buf8(buf_len);
    for (i2 = 0, m_pos = 0;i2 < buf_len; m_pos++) {
      c = str.charCodeAt(m_pos);
      if ((c & 64512) === 55296 && m_pos + 1 < str_len) {
        c2 = str.charCodeAt(m_pos + 1);
        if ((c2 & 64512) === 56320) {
          c = 65536 + (c - 55296 << 10) + (c2 - 56320);
          m_pos++;
        }
      }
      if (c < 128) {
        buf[i2++] = c;
      } else if (c < 2048) {
        buf[i2++] = 192 | c >>> 6;
        buf[i2++] = 128 | c & 63;
      } else if (c < 65536) {
        buf[i2++] = 224 | c >>> 12;
        buf[i2++] = 128 | c >>> 6 & 63;
        buf[i2++] = 128 | c & 63;
      } else {
        buf[i2++] = 240 | c >>> 18;
        buf[i2++] = 128 | c >>> 12 & 63;
        buf[i2++] = 128 | c >>> 6 & 63;
        buf[i2++] = 128 | c & 63;
      }
    }
    return buf;
  };
  function buf2binstring(buf, len2) {
    if (len2 < 65534) {
      if (buf.subarray && STR_APPLY_UIA_OK || !buf.subarray && STR_APPLY_OK) {
        return String.fromCharCode.apply(null, utils.shrinkBuf(buf, len2));
      }
    }
    var result = "";
    for (var i2 = 0;i2 < len2; i2++) {
      result += String.fromCharCode(buf[i2]);
    }
    return result;
  }
  exports.buf2binstring = function(buf) {
    return buf2binstring(buf, buf.length);
  };
  exports.binstring2buf = function(str) {
    var buf = new utils.Buf8(str.length);
    for (var i2 = 0, len2 = buf.length;i2 < len2; i2++) {
      buf[i2] = str.charCodeAt(i2);
    }
    return buf;
  };
  exports.buf2string = function(buf, max) {
    var i2, out, c, c_len;
    var len2 = max || buf.length;
    var utf16buf = new Array(len2 * 2);
    for (out = 0, i2 = 0;i2 < len2; ) {
      c = buf[i2++];
      if (c < 128) {
        utf16buf[out++] = c;
        continue;
      }
      c_len = _utf8len[c];
      if (c_len > 4) {
        utf16buf[out++] = 65533;
        i2 += c_len - 1;
        continue;
      }
      c &= c_len === 2 ? 31 : c_len === 3 ? 15 : 7;
      while (c_len > 1 && i2 < len2) {
        c = c << 6 | buf[i2++] & 63;
        c_len--;
      }
      if (c_len > 1) {
        utf16buf[out++] = 65533;
        continue;
      }
      if (c < 65536) {
        utf16buf[out++] = c;
      } else {
        c -= 65536;
        utf16buf[out++] = 55296 | c >> 10 & 1023;
        utf16buf[out++] = 56320 | c & 1023;
      }
    }
    return buf2binstring(utf16buf, out);
  };
  exports.utf8border = function(buf, max) {
    var pos;
    max = max || buf.length;
    if (max > buf.length) {
      max = buf.length;
    }
    pos = max - 1;
    while (pos >= 0 && (buf[pos] & 192) === 128) {
      pos--;
    }
    if (pos < 0) {
      return max;
    }
    if (pos === 0) {
      return max;
    }
    return pos + _utf8len[buf[pos]] > max ? pos : max;
  };
});

// node_modules/pako/lib/zlib/zstream.js
var require_zstream = __commonJS((exports, module) => {
  function ZStream() {
    this.input = null;
    this.next_in = 0;
    this.avail_in = 0;
    this.total_in = 0;
    this.output = null;
    this.next_out = 0;
    this.avail_out = 0;
    this.total_out = 0;
    this.msg = "";
    this.state = null;
    this.data_type = 2;
    this.adler = 0;
  }
  module.exports = ZStream;
});

// node_modules/pako/lib/deflate.js
var require_deflate2 = __commonJS((exports) => {
  var zlib_deflate = require_deflate();
  var utils = require_common();
  var strings = require_strings();
  var msg = require_messages();
  var ZStream = require_zstream();
  var toString = Object.prototype.toString;
  var Z_NO_FLUSH = 0;
  var Z_FINISH = 4;
  var Z_OK = 0;
  var Z_STREAM_END = 1;
  var Z_SYNC_FLUSH = 2;
  var Z_DEFAULT_COMPRESSION = -1;
  var Z_DEFAULT_STRATEGY = 0;
  var Z_DEFLATED = 8;
  function Deflate(options) {
    if (!(this instanceof Deflate))
      return new Deflate(options);
    this.options = utils.assign({
      level: Z_DEFAULT_COMPRESSION,
      method: Z_DEFLATED,
      chunkSize: 16384,
      windowBits: 15,
      memLevel: 8,
      strategy: Z_DEFAULT_STRATEGY,
      to: ""
    }, options || {});
    var opt = this.options;
    if (opt.raw && opt.windowBits > 0) {
      opt.windowBits = -opt.windowBits;
    } else if (opt.gzip && opt.windowBits > 0 && opt.windowBits < 16) {
      opt.windowBits += 16;
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new ZStream;
    this.strm.avail_out = 0;
    var status = zlib_deflate.deflateInit2(this.strm, opt.level, opt.method, opt.windowBits, opt.memLevel, opt.strategy);
    if (status !== Z_OK) {
      throw new Error(msg[status]);
    }
    if (opt.header) {
      zlib_deflate.deflateSetHeader(this.strm, opt.header);
    }
    if (opt.dictionary) {
      var dict;
      if (typeof opt.dictionary === "string") {
        dict = strings.string2buf(opt.dictionary);
      } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
        dict = new Uint8Array(opt.dictionary);
      } else {
        dict = opt.dictionary;
      }
      status = zlib_deflate.deflateSetDictionary(this.strm, dict);
      if (status !== Z_OK) {
        throw new Error(msg[status]);
      }
      this._dict_set = true;
    }
  }
  Deflate.prototype.push = function(data, mode) {
    var strm = this.strm;
    var chunkSize = this.options.chunkSize;
    var status, _mode;
    if (this.ended) {
      return false;
    }
    _mode = mode === ~~mode ? mode : mode === true ? Z_FINISH : Z_NO_FLUSH;
    if (typeof data === "string") {
      strm.input = strings.string2buf(data);
    } else if (toString.call(data) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    do {
      if (strm.avail_out === 0) {
        strm.output = new utils.Buf8(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = zlib_deflate.deflate(strm, _mode);
      if (status !== Z_STREAM_END && status !== Z_OK) {
        this.onEnd(status);
        this.ended = true;
        return false;
      }
      if (strm.avail_out === 0 || strm.avail_in === 0 && (_mode === Z_FINISH || _mode === Z_SYNC_FLUSH)) {
        if (this.options.to === "string") {
          this.onData(strings.buf2binstring(utils.shrinkBuf(strm.output, strm.next_out)));
        } else {
          this.onData(utils.shrinkBuf(strm.output, strm.next_out));
        }
      }
    } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== Z_STREAM_END);
    if (_mode === Z_FINISH) {
      status = zlib_deflate.deflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === Z_OK;
    }
    if (_mode === Z_SYNC_FLUSH) {
      this.onEnd(Z_OK);
      strm.avail_out = 0;
      return true;
    }
    return true;
  };
  Deflate.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Deflate.prototype.onEnd = function(status) {
    if (status === Z_OK) {
      if (this.options.to === "string") {
        this.result = this.chunks.join("");
      } else {
        this.result = utils.flattenChunks(this.chunks);
      }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function deflate(input, options) {
    var deflator = new Deflate(options);
    deflator.push(input, true);
    if (deflator.err) {
      throw deflator.msg || msg[deflator.err];
    }
    return deflator.result;
  }
  function deflateRaw(input, options) {
    options = options || {};
    options.raw = true;
    return deflate(input, options);
  }
  function gzip(input, options) {
    options = options || {};
    options.gzip = true;
    return deflate(input, options);
  }
  exports.Deflate = Deflate;
  exports.deflate = deflate;
  exports.deflateRaw = deflateRaw;
  exports.gzip = gzip;
});

// node_modules/pako/lib/zlib/inffast.js
var require_inffast = __commonJS((exports, module) => {
  var BAD = 30;
  var TYPE = 12;
  module.exports = function inflate_fast(strm, start) {
    var state;
    var _in;
    var last;
    var _out;
    var beg;
    var end;
    var dmax;
    var wsize;
    var whave;
    var wnext;
    var s_window;
    var hold;
    var bits;
    var lcode;
    var dcode;
    var lmask;
    var dmask;
    var here;
    var op;
    var len2;
    var dist;
    var from2;
    var from_source;
    var input, output;
    state = strm.state;
    _in = strm.next_in;
    input = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
    dmax = state.dmax;
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;
    top:
      do {
        if (bits < 15) {
          hold += input[_in++] << bits;
          bits += 8;
          hold += input[_in++] << bits;
          bits += 8;
        }
        here = lcode[hold & lmask];
        dolen:
          for (;; ) {
            op = here >>> 24;
            hold >>>= op;
            bits -= op;
            op = here >>> 16 & 255;
            if (op === 0) {
              output[_out++] = here & 65535;
            } else if (op & 16) {
              len2 = here & 65535;
              op &= 15;
              if (op) {
                if (bits < op) {
                  hold += input[_in++] << bits;
                  bits += 8;
                }
                len2 += hold & (1 << op) - 1;
                hold >>>= op;
                bits -= op;
              }
              if (bits < 15) {
                hold += input[_in++] << bits;
                bits += 8;
                hold += input[_in++] << bits;
                bits += 8;
              }
              here = dcode[hold & dmask];
              dodist:
                for (;; ) {
                  op = here >>> 24;
                  hold >>>= op;
                  bits -= op;
                  op = here >>> 16 & 255;
                  if (op & 16) {
                    dist = here & 65535;
                    op &= 15;
                    if (bits < op) {
                      hold += input[_in++] << bits;
                      bits += 8;
                      if (bits < op) {
                        hold += input[_in++] << bits;
                        bits += 8;
                      }
                    }
                    dist += hold & (1 << op) - 1;
                    if (dist > dmax) {
                      strm.msg = "invalid distance too far back";
                      state.mode = BAD;
                      break top;
                    }
                    hold >>>= op;
                    bits -= op;
                    op = _out - beg;
                    if (dist > op) {
                      op = dist - op;
                      if (op > whave) {
                        if (state.sane) {
                          strm.msg = "invalid distance too far back";
                          state.mode = BAD;
                          break top;
                        }
                      }
                      from2 = 0;
                      from_source = s_window;
                      if (wnext === 0) {
                        from2 += wsize - op;
                        if (op < len2) {
                          len2 -= op;
                          do {
                            output[_out++] = s_window[from2++];
                          } while (--op);
                          from2 = _out - dist;
                          from_source = output;
                        }
                      } else if (wnext < op) {
                        from2 += wsize + wnext - op;
                        op -= wnext;
                        if (op < len2) {
                          len2 -= op;
                          do {
                            output[_out++] = s_window[from2++];
                          } while (--op);
                          from2 = 0;
                          if (wnext < len2) {
                            op = wnext;
                            len2 -= op;
                            do {
                              output[_out++] = s_window[from2++];
                            } while (--op);
                            from2 = _out - dist;
                            from_source = output;
                          }
                        }
                      } else {
                        from2 += wnext - op;
                        if (op < len2) {
                          len2 -= op;
                          do {
                            output[_out++] = s_window[from2++];
                          } while (--op);
                          from2 = _out - dist;
                          from_source = output;
                        }
                      }
                      while (len2 > 2) {
                        output[_out++] = from_source[from2++];
                        output[_out++] = from_source[from2++];
                        output[_out++] = from_source[from2++];
                        len2 -= 3;
                      }
                      if (len2) {
                        output[_out++] = from_source[from2++];
                        if (len2 > 1) {
                          output[_out++] = from_source[from2++];
                        }
                      }
                    } else {
                      from2 = _out - dist;
                      do {
                        output[_out++] = output[from2++];
                        output[_out++] = output[from2++];
                        output[_out++] = output[from2++];
                        len2 -= 3;
                      } while (len2 > 2);
                      if (len2) {
                        output[_out++] = output[from2++];
                        if (len2 > 1) {
                          output[_out++] = output[from2++];
                        }
                      }
                    }
                  } else if ((op & 64) === 0) {
                    here = dcode[(here & 65535) + (hold & (1 << op) - 1)];
                    continue dodist;
                  } else {
                    strm.msg = "invalid distance code";
                    state.mode = BAD;
                    break top;
                  }
                  break;
                }
            } else if ((op & 64) === 0) {
              here = lcode[(here & 65535) + (hold & (1 << op) - 1)];
              continue dolen;
            } else if (op & 32) {
              state.mode = TYPE;
              break top;
            } else {
              strm.msg = "invalid literal/length code";
              state.mode = BAD;
              break top;
            }
            break;
          }
      } while (_in < last && _out < end);
    len2 = bits >> 3;
    _in -= len2;
    bits -= len2 << 3;
    hold &= (1 << bits) - 1;
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = _in < last ? 5 + (last - _in) : 5 - (_in - last);
    strm.avail_out = _out < end ? 257 + (end - _out) : 257 - (_out - end);
    state.hold = hold;
    state.bits = bits;
    return;
  };
});

// node_modules/pako/lib/zlib/inftrees.js
var require_inftrees = __commonJS((exports, module) => {
  var utils = require_common();
  var MAXBITS = 15;
  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;
  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;
  var lbase = [
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    13,
    15,
    17,
    19,
    23,
    27,
    31,
    35,
    43,
    51,
    59,
    67,
    83,
    99,
    115,
    131,
    163,
    195,
    227,
    258,
    0,
    0
  ];
  var lext = [
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    16,
    17,
    17,
    17,
    17,
    18,
    18,
    18,
    18,
    19,
    19,
    19,
    19,
    20,
    20,
    20,
    20,
    21,
    21,
    21,
    21,
    16,
    72,
    78
  ];
  var dbase = [
    1,
    2,
    3,
    4,
    5,
    7,
    9,
    13,
    17,
    25,
    33,
    49,
    65,
    97,
    129,
    193,
    257,
    385,
    513,
    769,
    1025,
    1537,
    2049,
    3073,
    4097,
    6145,
    8193,
    12289,
    16385,
    24577,
    0,
    0
  ];
  var dext = [
    16,
    16,
    16,
    16,
    17,
    17,
    18,
    18,
    19,
    19,
    20,
    20,
    21,
    21,
    22,
    22,
    23,
    23,
    24,
    24,
    25,
    25,
    26,
    26,
    27,
    27,
    28,
    28,
    29,
    29,
    64,
    64
  ];
  module.exports = function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
    var bits = opts.bits;
    var len2 = 0;
    var sym = 0;
    var min = 0, max = 0;
    var root = 0;
    var curr = 0;
    var drop = 0;
    var left = 0;
    var used = 0;
    var huff = 0;
    var incr;
    var fill;
    var low;
    var mask;
    var next;
    var base = null;
    var base_index = 0;
    var end;
    var count = new utils.Buf16(MAXBITS + 1);
    var offs = new utils.Buf16(MAXBITS + 1);
    var extra = null;
    var extra_index = 0;
    var here_bits, here_op, here_val;
    for (len2 = 0;len2 <= MAXBITS; len2++) {
      count[len2] = 0;
    }
    for (sym = 0;sym < codes; sym++) {
      count[lens[lens_index + sym]]++;
    }
    root = bits;
    for (max = MAXBITS;max >= 1; max--) {
      if (count[max] !== 0) {
        break;
      }
    }
    if (root > max) {
      root = max;
    }
    if (max === 0) {
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      table[table_index++] = 1 << 24 | 64 << 16 | 0;
      opts.bits = 1;
      return 0;
    }
    for (min = 1;min < max; min++) {
      if (count[min] !== 0) {
        break;
      }
    }
    if (root < min) {
      root = min;
    }
    left = 1;
    for (len2 = 1;len2 <= MAXBITS; len2++) {
      left <<= 1;
      left -= count[len2];
      if (left < 0) {
        return -1;
      }
    }
    if (left > 0 && (type === CODES || max !== 1)) {
      return -1;
    }
    offs[1] = 0;
    for (len2 = 1;len2 < MAXBITS; len2++) {
      offs[len2 + 1] = offs[len2] + count[len2];
    }
    for (sym = 0;sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym;
      }
    }
    if (type === CODES) {
      base = extra = work;
      end = 19;
    } else if (type === LENS) {
      base = lbase;
      base_index -= 257;
      extra = lext;
      extra_index -= 257;
      end = 256;
    } else {
      base = dbase;
      extra = dext;
      end = -1;
    }
    huff = 0;
    sym = 0;
    len2 = min;
    next = table_index;
    curr = root;
    drop = 0;
    low = -1;
    used = 1 << root;
    mask = used - 1;
    if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
      return 1;
    }
    for (;; ) {
      here_bits = len2 - drop;
      if (work[sym] < end) {
        here_op = 0;
        here_val = work[sym];
      } else if (work[sym] > end) {
        here_op = extra[extra_index + work[sym]];
        here_val = base[base_index + work[sym]];
      } else {
        here_op = 32 + 64;
        here_val = 0;
      }
      incr = 1 << len2 - drop;
      fill = 1 << curr;
      min = fill;
      do {
        fill -= incr;
        table[next + (huff >> drop) + fill] = here_bits << 24 | here_op << 16 | here_val | 0;
      } while (fill !== 0);
      incr = 1 << len2 - 1;
      while (huff & incr) {
        incr >>= 1;
      }
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      } else {
        huff = 0;
      }
      sym++;
      if (--count[len2] === 0) {
        if (len2 === max) {
          break;
        }
        len2 = lens[lens_index + work[sym]];
      }
      if (len2 > root && (huff & mask) !== low) {
        if (drop === 0) {
          drop = root;
        }
        next += min;
        curr = len2 - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count[curr + drop];
          if (left <= 0) {
            break;
          }
          curr++;
          left <<= 1;
        }
        used += 1 << curr;
        if (type === LENS && used > ENOUGH_LENS || type === DISTS && used > ENOUGH_DISTS) {
          return 1;
        }
        low = huff & mask;
        table[low] = root << 24 | curr << 16 | next - table_index | 0;
      }
    }
    if (huff !== 0) {
      table[next + huff] = len2 - drop << 24 | 64 << 16 | 0;
    }
    opts.bits = root;
    return 0;
  };
});

// node_modules/pako/lib/zlib/inflate.js
var require_inflate = __commonJS((exports) => {
  var utils = require_common();
  var adler32 = require_adler32();
  var crc32 = require_crc322();
  var inflate_fast = require_inffast();
  var inflate_table = require_inftrees();
  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;
  var Z_FINISH = 4;
  var Z_BLOCK = 5;
  var Z_TREES = 6;
  var Z_OK = 0;
  var Z_STREAM_END = 1;
  var Z_NEED_DICT = 2;
  var Z_STREAM_ERROR = -2;
  var Z_DATA_ERROR = -3;
  var Z_MEM_ERROR = -4;
  var Z_BUF_ERROR = -5;
  var Z_DEFLATED = 8;
  var HEAD = 1;
  var FLAGS = 2;
  var TIME = 3;
  var OS = 4;
  var EXLEN = 5;
  var EXTRA = 6;
  var NAME = 7;
  var COMMENT = 8;
  var HCRC = 9;
  var DICTID = 10;
  var DICT = 11;
  var TYPE = 12;
  var TYPEDO = 13;
  var STORED = 14;
  var COPY_ = 15;
  var COPY = 16;
  var TABLE = 17;
  var LENLENS = 18;
  var CODELENS = 19;
  var LEN_ = 20;
  var LEN = 21;
  var LENEXT = 22;
  var DIST = 23;
  var DISTEXT = 24;
  var MATCH = 25;
  var LIT = 26;
  var CHECK = 27;
  var LENGTH = 28;
  var DONE = 29;
  var BAD = 30;
  var MEM = 31;
  var SYNC = 32;
  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;
  var MAX_WBITS = 15;
  var DEF_WBITS = MAX_WBITS;
  function zswap32(q) {
    return (q >>> 24 & 255) + (q >>> 8 & 65280) + ((q & 65280) << 8) + ((q & 255) << 24);
  }
  function InflateState() {
    this.mode = 0;
    this.last = false;
    this.wrap = 0;
    this.havedict = false;
    this.flags = 0;
    this.dmax = 0;
    this.check = 0;
    this.total = 0;
    this.head = null;
    this.wbits = 0;
    this.wsize = 0;
    this.whave = 0;
    this.wnext = 0;
    this.window = null;
    this.hold = 0;
    this.bits = 0;
    this.length = 0;
    this.offset = 0;
    this.extra = 0;
    this.lencode = null;
    this.distcode = null;
    this.lenbits = 0;
    this.distbits = 0;
    this.ncode = 0;
    this.nlen = 0;
    this.ndist = 0;
    this.have = 0;
    this.next = null;
    this.lens = new utils.Buf16(320);
    this.work = new utils.Buf16(288);
    this.lendyn = null;
    this.distdyn = null;
    this.sane = 0;
    this.back = 0;
    this.was = 0;
  }
  function inflateResetKeep(strm) {
    var state;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = "";
    if (state.wrap) {
      strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.dmax = 32768;
    state.head = null;
    state.hold = 0;
    state.bits = 0;
    state.lencode = state.lendyn = new utils.Buf32(ENOUGH_LENS);
    state.distcode = state.distdyn = new utils.Buf32(ENOUGH_DISTS);
    state.sane = 1;
    state.back = -1;
    return Z_OK;
  }
  function inflateReset(strm) {
    var state;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);
  }
  function inflateReset2(strm, windowBits) {
    var wrap;
    var state;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    state = strm.state;
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else {
      wrap = (windowBits >> 4) + 1;
      if (windowBits < 48) {
        windowBits &= 15;
      }
    }
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR;
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null;
    }
    state.wrap = wrap;
    state.wbits = windowBits;
    return inflateReset(strm);
  }
  function inflateInit2(strm, windowBits) {
    var ret;
    var state;
    if (!strm) {
      return Z_STREAM_ERROR;
    }
    state = new InflateState;
    strm.state = state;
    state.window = null;
    ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK) {
      strm.state = null;
    }
    return ret;
  }
  function inflateInit(strm) {
    return inflateInit2(strm, DEF_WBITS);
  }
  var virgin = true;
  var lenfix;
  var distfix;
  function fixedtables(state) {
    if (virgin) {
      var sym;
      lenfix = new utils.Buf32(512);
      distfix = new utils.Buf32(32);
      sym = 0;
      while (sym < 144) {
        state.lens[sym++] = 8;
      }
      while (sym < 256) {
        state.lens[sym++] = 9;
      }
      while (sym < 280) {
        state.lens[sym++] = 7;
      }
      while (sym < 288) {
        state.lens[sym++] = 8;
      }
      inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, { bits: 9 });
      sym = 0;
      while (sym < 32) {
        state.lens[sym++] = 5;
      }
      inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, { bits: 5 });
      virgin = false;
    }
    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
  }
  function updatewindow(strm, src, end, copy) {
    var dist;
    var state = strm.state;
    if (state.window === null) {
      state.wsize = 1 << state.wbits;
      state.wnext = 0;
      state.whave = 0;
      state.window = new utils.Buf8(state.wsize);
    }
    if (copy >= state.wsize) {
      utils.arraySet(state.window, src, end - state.wsize, state.wsize, 0);
      state.wnext = 0;
      state.whave = state.wsize;
    } else {
      dist = state.wsize - state.wnext;
      if (dist > copy) {
        dist = copy;
      }
      utils.arraySet(state.window, src, end - copy, dist, state.wnext);
      copy -= dist;
      if (copy) {
        utils.arraySet(state.window, src, end - copy, copy, 0);
        state.wnext = copy;
        state.whave = state.wsize;
      } else {
        state.wnext += dist;
        if (state.wnext === state.wsize) {
          state.wnext = 0;
        }
        if (state.whave < state.wsize) {
          state.whave += dist;
        }
      }
    }
    return 0;
  }
  function inflate(strm, flush) {
    var state;
    var input, output;
    var next;
    var put;
    var have, left;
    var hold;
    var bits;
    var _in, _out;
    var copy;
    var from2;
    var from_source;
    var here = 0;
    var here_bits, here_op, here_val;
    var last_bits, last_op, last_val;
    var len2;
    var ret;
    var hbuf = new utils.Buf8(4);
    var opts;
    var n;
    var order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
    if (!strm || !strm.state || !strm.output || !strm.input && strm.avail_in !== 0) {
      return Z_STREAM_ERROR;
    }
    state = strm.state;
    if (state.mode === TYPE) {
      state.mode = TYPEDO;
    }
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
    _in = have;
    _out = left;
    ret = Z_OK;
    inf_leave:
      for (;; ) {
        switch (state.mode) {
          case HEAD:
            if (state.wrap === 0) {
              state.mode = TYPEDO;
              break;
            }
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.wrap & 2 && hold === 35615) {
              state.check = 0;
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32(state.check, hbuf, 2, 0);
              hold = 0;
              bits = 0;
              state.mode = FLAGS;
              break;
            }
            state.flags = 0;
            if (state.head) {
              state.head.done = false;
            }
            if (!(state.wrap & 1) || (((hold & 255) << 8) + (hold >> 8)) % 31) {
              strm.msg = "incorrect header check";
              state.mode = BAD;
              break;
            }
            if ((hold & 15) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            hold >>>= 4;
            bits -= 4;
            len2 = (hold & 15) + 8;
            if (state.wbits === 0) {
              state.wbits = len2;
            } else if (len2 > state.wbits) {
              strm.msg = "invalid window size";
              state.mode = BAD;
              break;
            }
            state.dmax = 1 << len2;
            strm.adler = state.check = 1;
            state.mode = hold & 512 ? DICTID : TYPE;
            hold = 0;
            bits = 0;
            break;
          case FLAGS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.flags = hold;
            if ((state.flags & 255) !== Z_DEFLATED) {
              strm.msg = "unknown compression method";
              state.mode = BAD;
              break;
            }
            if (state.flags & 57344) {
              strm.msg = "unknown header flags set";
              state.mode = BAD;
              break;
            }
            if (state.head) {
              state.head.text = hold >> 8 & 1;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = TIME;
          case TIME:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.time = hold;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              hbuf[2] = hold >>> 16 & 255;
              hbuf[3] = hold >>> 24 & 255;
              state.check = crc32(state.check, hbuf, 4, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = OS;
          case OS:
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (state.head) {
              state.head.xflags = hold & 255;
              state.head.os = hold >> 8;
            }
            if (state.flags & 512) {
              hbuf[0] = hold & 255;
              hbuf[1] = hold >>> 8 & 255;
              state.check = crc32(state.check, hbuf, 2, 0);
            }
            hold = 0;
            bits = 0;
            state.mode = EXLEN;
          case EXLEN:
            if (state.flags & 1024) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.length = hold;
              if (state.head) {
                state.head.extra_len = hold;
              }
              if (state.flags & 512) {
                hbuf[0] = hold & 255;
                hbuf[1] = hold >>> 8 & 255;
                state.check = crc32(state.check, hbuf, 2, 0);
              }
              hold = 0;
              bits = 0;
            } else if (state.head) {
              state.head.extra = null;
            }
            state.mode = EXTRA;
          case EXTRA:
            if (state.flags & 1024) {
              copy = state.length;
              if (copy > have) {
                copy = have;
              }
              if (copy) {
                if (state.head) {
                  len2 = state.head.extra_len - state.length;
                  if (!state.head.extra) {
                    state.head.extra = new Array(state.head.extra_len);
                  }
                  utils.arraySet(state.head.extra, input, next, copy, len2);
                }
                if (state.flags & 512) {
                  state.check = crc32(state.check, input, copy, next);
                }
                have -= copy;
                next += copy;
                state.length -= copy;
              }
              if (state.length) {
                break inf_leave;
              }
            }
            state.length = 0;
            state.mode = NAME;
          case NAME:
            if (state.flags & 2048) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len2 = input[next + copy++];
                if (state.head && len2 && state.length < 65536) {
                  state.head.name += String.fromCharCode(len2);
                }
              } while (len2 && copy < have);
              if (state.flags & 512) {
                state.check = crc32(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              if (len2) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.name = null;
            }
            state.length = 0;
            state.mode = COMMENT;
          case COMMENT:
            if (state.flags & 4096) {
              if (have === 0) {
                break inf_leave;
              }
              copy = 0;
              do {
                len2 = input[next + copy++];
                if (state.head && len2 && state.length < 65536) {
                  state.head.comment += String.fromCharCode(len2);
                }
              } while (len2 && copy < have);
              if (state.flags & 512) {
                state.check = crc32(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              if (len2) {
                break inf_leave;
              }
            } else if (state.head) {
              state.head.comment = null;
            }
            state.mode = HCRC;
          case HCRC:
            if (state.flags & 512) {
              while (bits < 16) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (hold !== (state.check & 65535)) {
                strm.msg = "header crc mismatch";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            if (state.head) {
              state.head.hcrc = state.flags >> 9 & 1;
              state.head.done = true;
            }
            strm.adler = state.check = 0;
            state.mode = TYPE;
            break;
          case DICTID:
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            strm.adler = state.check = zswap32(hold);
            hold = 0;
            bits = 0;
            state.mode = DICT;
          case DICT:
            if (state.havedict === 0) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              return Z_NEED_DICT;
            }
            strm.adler = state.check = 1;
            state.mode = TYPE;
          case TYPE:
            if (flush === Z_BLOCK || flush === Z_TREES) {
              break inf_leave;
            }
          case TYPEDO:
            if (state.last) {
              hold >>>= bits & 7;
              bits -= bits & 7;
              state.mode = CHECK;
              break;
            }
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.last = hold & 1;
            hold >>>= 1;
            bits -= 1;
            switch (hold & 3) {
              case 0:
                state.mode = STORED;
                break;
              case 1:
                fixedtables(state);
                state.mode = LEN_;
                if (flush === Z_TREES) {
                  hold >>>= 2;
                  bits -= 2;
                  break inf_leave;
                }
                break;
              case 2:
                state.mode = TABLE;
                break;
              case 3:
                strm.msg = "invalid block type";
                state.mode = BAD;
            }
            hold >>>= 2;
            bits -= 2;
            break;
          case STORED:
            hold >>>= bits & 7;
            bits -= bits & 7;
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if ((hold & 65535) !== (hold >>> 16 ^ 65535)) {
              strm.msg = "invalid stored block lengths";
              state.mode = BAD;
              break;
            }
            state.length = hold & 65535;
            hold = 0;
            bits = 0;
            state.mode = COPY_;
            if (flush === Z_TREES) {
              break inf_leave;
            }
          case COPY_:
            state.mode = COPY;
          case COPY:
            copy = state.length;
            if (copy) {
              if (copy > have) {
                copy = have;
              }
              if (copy > left) {
                copy = left;
              }
              if (copy === 0) {
                break inf_leave;
              }
              utils.arraySet(output, input, next, copy, put);
              have -= copy;
              next += copy;
              left -= copy;
              put += copy;
              state.length -= copy;
              break;
            }
            state.mode = TYPE;
            break;
          case TABLE:
            while (bits < 14) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            state.nlen = (hold & 31) + 257;
            hold >>>= 5;
            bits -= 5;
            state.ndist = (hold & 31) + 1;
            hold >>>= 5;
            bits -= 5;
            state.ncode = (hold & 15) + 4;
            hold >>>= 4;
            bits -= 4;
            if (state.nlen > 286 || state.ndist > 30) {
              strm.msg = "too many length or distance symbols";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = LENLENS;
          case LENLENS:
            while (state.have < state.ncode) {
              while (bits < 3) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.lens[order[state.have++]] = hold & 7;
              hold >>>= 3;
              bits -= 3;
            }
            while (state.have < 19) {
              state.lens[order[state.have++]] = 0;
            }
            state.lencode = state.lendyn;
            state.lenbits = 7;
            opts = { bits: state.lenbits };
            ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid code lengths set";
              state.mode = BAD;
              break;
            }
            state.have = 0;
            state.mode = CODELENS;
          case CODELENS:
            while (state.have < state.nlen + state.ndist) {
              for (;; ) {
                here = state.lencode[hold & (1 << state.lenbits) - 1];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (here_val < 16) {
                hold >>>= here_bits;
                bits -= here_bits;
                state.lens[state.have++] = here_val;
              } else {
                if (here_val === 16) {
                  n = here_bits + 2;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  if (state.have === 0) {
                    strm.msg = "invalid bit length repeat";
                    state.mode = BAD;
                    break;
                  }
                  len2 = state.lens[state.have - 1];
                  copy = 3 + (hold & 3);
                  hold >>>= 2;
                  bits -= 2;
                } else if (here_val === 17) {
                  n = here_bits + 3;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len2 = 0;
                  copy = 3 + (hold & 7);
                  hold >>>= 3;
                  bits -= 3;
                } else {
                  n = here_bits + 7;
                  while (bits < n) {
                    if (have === 0) {
                      break inf_leave;
                    }
                    have--;
                    hold += input[next++] << bits;
                    bits += 8;
                  }
                  hold >>>= here_bits;
                  bits -= here_bits;
                  len2 = 0;
                  copy = 11 + (hold & 127);
                  hold >>>= 7;
                  bits -= 7;
                }
                if (state.have + copy > state.nlen + state.ndist) {
                  strm.msg = "invalid bit length repeat";
                  state.mode = BAD;
                  break;
                }
                while (copy--) {
                  state.lens[state.have++] = len2;
                }
              }
            }
            if (state.mode === BAD) {
              break;
            }
            if (state.lens[256] === 0) {
              strm.msg = "invalid code -- missing end-of-block";
              state.mode = BAD;
              break;
            }
            state.lenbits = 9;
            opts = { bits: state.lenbits };
            ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
            state.lenbits = opts.bits;
            if (ret) {
              strm.msg = "invalid literal/lengths set";
              state.mode = BAD;
              break;
            }
            state.distbits = 6;
            state.distcode = state.distdyn;
            opts = { bits: state.distbits };
            ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
            state.distbits = opts.bits;
            if (ret) {
              strm.msg = "invalid distances set";
              state.mode = BAD;
              break;
            }
            state.mode = LEN_;
            if (flush === Z_TREES) {
              break inf_leave;
            }
          case LEN_:
            state.mode = LEN;
          case LEN:
            if (have >= 6 && left >= 258) {
              strm.next_out = put;
              strm.avail_out = left;
              strm.next_in = next;
              strm.avail_in = have;
              state.hold = hold;
              state.bits = bits;
              inflate_fast(strm, _out);
              put = strm.next_out;
              output = strm.output;
              left = strm.avail_out;
              next = strm.next_in;
              input = strm.input;
              have = strm.avail_in;
              hold = state.hold;
              bits = state.bits;
              if (state.mode === TYPE) {
                state.back = -1;
              }
              break;
            }
            state.back = 0;
            for (;; ) {
              here = state.lencode[hold & (1 << state.lenbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if (here_op && (here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (;; ) {
                here = state.lencode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            state.length = here_val;
            if (here_op === 0) {
              state.mode = LIT;
              break;
            }
            if (here_op & 32) {
              state.back = -1;
              state.mode = TYPE;
              break;
            }
            if (here_op & 64) {
              strm.msg = "invalid literal/length code";
              state.mode = BAD;
              break;
            }
            state.extra = here_op & 15;
            state.mode = LENEXT;
          case LENEXT:
            if (state.extra) {
              n = state.extra;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.length += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            state.was = state.length;
            state.mode = DIST;
          case DIST:
            for (;; ) {
              here = state.distcode[hold & (1 << state.distbits) - 1];
              here_bits = here >>> 24;
              here_op = here >>> 16 & 255;
              here_val = here & 65535;
              if (here_bits <= bits) {
                break;
              }
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            if ((here_op & 240) === 0) {
              last_bits = here_bits;
              last_op = here_op;
              last_val = here_val;
              for (;; ) {
                here = state.distcode[last_val + ((hold & (1 << last_bits + last_op) - 1) >> last_bits)];
                here_bits = here >>> 24;
                here_op = here >>> 16 & 255;
                here_val = here & 65535;
                if (last_bits + here_bits <= bits) {
                  break;
                }
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              hold >>>= last_bits;
              bits -= last_bits;
              state.back += last_bits;
            }
            hold >>>= here_bits;
            bits -= here_bits;
            state.back += here_bits;
            if (here_op & 64) {
              strm.msg = "invalid distance code";
              state.mode = BAD;
              break;
            }
            state.offset = here_val;
            state.extra = here_op & 15;
            state.mode = DISTEXT;
          case DISTEXT:
            if (state.extra) {
              n = state.extra;
              while (bits < n) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              state.offset += hold & (1 << state.extra) - 1;
              hold >>>= state.extra;
              bits -= state.extra;
              state.back += state.extra;
            }
            if (state.offset > state.dmax) {
              strm.msg = "invalid distance too far back";
              state.mode = BAD;
              break;
            }
            state.mode = MATCH;
          case MATCH:
            if (left === 0) {
              break inf_leave;
            }
            copy = _out - left;
            if (state.offset > copy) {
              copy = state.offset - copy;
              if (copy > state.whave) {
                if (state.sane) {
                  strm.msg = "invalid distance too far back";
                  state.mode = BAD;
                  break;
                }
              }
              if (copy > state.wnext) {
                copy -= state.wnext;
                from2 = state.wsize - copy;
              } else {
                from2 = state.wnext - copy;
              }
              if (copy > state.length) {
                copy = state.length;
              }
              from_source = state.window;
            } else {
              from_source = output;
              from2 = put - state.offset;
              copy = state.length;
            }
            if (copy > left) {
              copy = left;
            }
            left -= copy;
            state.length -= copy;
            do {
              output[put++] = from_source[from2++];
            } while (--copy);
            if (state.length === 0) {
              state.mode = LEN;
            }
            break;
          case LIT:
            if (left === 0) {
              break inf_leave;
            }
            output[put++] = state.length;
            left--;
            state.mode = LEN;
            break;
          case CHECK:
            if (state.wrap) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold |= input[next++] << bits;
                bits += 8;
              }
              _out -= left;
              strm.total_out += _out;
              state.total += _out;
              if (_out) {
                strm.adler = state.check = state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out);
              }
              _out = left;
              if ((state.flags ? hold : zswap32(hold)) !== state.check) {
                strm.msg = "incorrect data check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = LENGTH;
          case LENGTH:
            if (state.wrap && state.flags) {
              while (bits < 32) {
                if (have === 0) {
                  break inf_leave;
                }
                have--;
                hold += input[next++] << bits;
                bits += 8;
              }
              if (hold !== (state.total & 4294967295)) {
                strm.msg = "incorrect length check";
                state.mode = BAD;
                break;
              }
              hold = 0;
              bits = 0;
            }
            state.mode = DONE;
          case DONE:
            ret = Z_STREAM_END;
            break inf_leave;
          case BAD:
            ret = Z_DATA_ERROR;
            break inf_leave;
          case MEM:
            return Z_MEM_ERROR;
          case SYNC:
          default:
            return Z_STREAM_ERROR;
        }
      }
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
    if (state.wsize || _out !== strm.avail_out && state.mode < BAD && (state.mode < CHECK || flush !== Z_FINISH)) {
      if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) {
        state.mode = MEM;
        return Z_MEM_ERROR;
      }
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap && _out) {
      strm.adler = state.check = state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out);
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) + (state.mode === TYPE ? 128 : 0) + (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if ((_in === 0 && _out === 0 || flush === Z_FINISH) && ret === Z_OK) {
      ret = Z_BUF_ERROR;
    }
    return ret;
  }
  function inflateEnd(strm) {
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    var state = strm.state;
    if (state.window) {
      state.window = null;
    }
    strm.state = null;
    return Z_OK;
  }
  function inflateGetHeader(strm, head) {
    var state;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    state = strm.state;
    if ((state.wrap & 2) === 0) {
      return Z_STREAM_ERROR;
    }
    state.head = head;
    head.done = false;
    return Z_OK;
  }
  function inflateSetDictionary(strm, dictionary) {
    var dictLength = dictionary.length;
    var state;
    var dictid;
    var ret;
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR;
    }
    state = strm.state;
    if (state.wrap !== 0 && state.mode !== DICT) {
      return Z_STREAM_ERROR;
    }
    if (state.mode === DICT) {
      dictid = 1;
      dictid = adler32(dictid, dictionary, dictLength, 0);
      if (dictid !== state.check) {
        return Z_DATA_ERROR;
      }
    }
    ret = updatewindow(strm, dictionary, dictLength, dictLength);
    if (ret) {
      state.mode = MEM;
      return Z_MEM_ERROR;
    }
    state.havedict = 1;
    return Z_OK;
  }
  exports.inflateReset = inflateReset;
  exports.inflateReset2 = inflateReset2;
  exports.inflateResetKeep = inflateResetKeep;
  exports.inflateInit = inflateInit;
  exports.inflateInit2 = inflateInit2;
  exports.inflate = inflate;
  exports.inflateEnd = inflateEnd;
  exports.inflateGetHeader = inflateGetHeader;
  exports.inflateSetDictionary = inflateSetDictionary;
  exports.inflateInfo = "pako inflate (from Nodeca project)";
});

// node_modules/pako/lib/zlib/constants.js
var require_constants = __commonJS((exports, module) => {
  module.exports = {
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_BUF_ERROR: -5,
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    Z_BINARY: 0,
    Z_TEXT: 1,
    Z_UNKNOWN: 2,
    Z_DEFLATED: 8
  };
});

// node_modules/pako/lib/zlib/gzheader.js
var require_gzheader = __commonJS((exports, module) => {
  function GZheader() {
    this.text = 0;
    this.time = 0;
    this.xflags = 0;
    this.os = 0;
    this.extra = null;
    this.extra_len = 0;
    this.name = "";
    this.comment = "";
    this.hcrc = 0;
    this.done = false;
  }
  module.exports = GZheader;
});

// node_modules/pako/lib/inflate.js
var require_inflate2 = __commonJS((exports) => {
  var zlib_inflate = require_inflate();
  var utils = require_common();
  var strings = require_strings();
  var c = require_constants();
  var msg = require_messages();
  var ZStream = require_zstream();
  var GZheader = require_gzheader();
  var toString = Object.prototype.toString;
  function Inflate(options) {
    if (!(this instanceof Inflate))
      return new Inflate(options);
    this.options = utils.assign({
      chunkSize: 16384,
      windowBits: 0,
      to: ""
    }, options || {});
    var opt = this.options;
    if (opt.raw && opt.windowBits >= 0 && opt.windowBits < 16) {
      opt.windowBits = -opt.windowBits;
      if (opt.windowBits === 0) {
        opt.windowBits = -15;
      }
    }
    if (opt.windowBits >= 0 && opt.windowBits < 16 && !(options && options.windowBits)) {
      opt.windowBits += 32;
    }
    if (opt.windowBits > 15 && opt.windowBits < 48) {
      if ((opt.windowBits & 15) === 0) {
        opt.windowBits |= 15;
      }
    }
    this.err = 0;
    this.msg = "";
    this.ended = false;
    this.chunks = [];
    this.strm = new ZStream;
    this.strm.avail_out = 0;
    var status = zlib_inflate.inflateInit2(this.strm, opt.windowBits);
    if (status !== c.Z_OK) {
      throw new Error(msg[status]);
    }
    this.header = new GZheader;
    zlib_inflate.inflateGetHeader(this.strm, this.header);
    if (opt.dictionary) {
      if (typeof opt.dictionary === "string") {
        opt.dictionary = strings.string2buf(opt.dictionary);
      } else if (toString.call(opt.dictionary) === "[object ArrayBuffer]") {
        opt.dictionary = new Uint8Array(opt.dictionary);
      }
      if (opt.raw) {
        status = zlib_inflate.inflateSetDictionary(this.strm, opt.dictionary);
        if (status !== c.Z_OK) {
          throw new Error(msg[status]);
        }
      }
    }
  }
  Inflate.prototype.push = function(data, mode) {
    var strm = this.strm;
    var chunkSize = this.options.chunkSize;
    var dictionary = this.options.dictionary;
    var status, _mode;
    var next_out_utf8, tail, utf8str;
    var allowBufError = false;
    if (this.ended) {
      return false;
    }
    _mode = mode === ~~mode ? mode : mode === true ? c.Z_FINISH : c.Z_NO_FLUSH;
    if (typeof data === "string") {
      strm.input = strings.binstring2buf(data);
    } else if (toString.call(data) === "[object ArrayBuffer]") {
      strm.input = new Uint8Array(data);
    } else {
      strm.input = data;
    }
    strm.next_in = 0;
    strm.avail_in = strm.input.length;
    do {
      if (strm.avail_out === 0) {
        strm.output = new utils.Buf8(chunkSize);
        strm.next_out = 0;
        strm.avail_out = chunkSize;
      }
      status = zlib_inflate.inflate(strm, c.Z_NO_FLUSH);
      if (status === c.Z_NEED_DICT && dictionary) {
        status = zlib_inflate.inflateSetDictionary(this.strm, dictionary);
      }
      if (status === c.Z_BUF_ERROR && allowBufError === true) {
        status = c.Z_OK;
        allowBufError = false;
      }
      if (status !== c.Z_STREAM_END && status !== c.Z_OK) {
        this.onEnd(status);
        this.ended = true;
        return false;
      }
      if (strm.next_out) {
        if (strm.avail_out === 0 || status === c.Z_STREAM_END || strm.avail_in === 0 && (_mode === c.Z_FINISH || _mode === c.Z_SYNC_FLUSH)) {
          if (this.options.to === "string") {
            next_out_utf8 = strings.utf8border(strm.output, strm.next_out);
            tail = strm.next_out - next_out_utf8;
            utf8str = strings.buf2string(strm.output, next_out_utf8);
            strm.next_out = tail;
            strm.avail_out = chunkSize - tail;
            if (tail) {
              utils.arraySet(strm.output, strm.output, next_out_utf8, tail, 0);
            }
            this.onData(utf8str);
          } else {
            this.onData(utils.shrinkBuf(strm.output, strm.next_out));
          }
        }
      }
      if (strm.avail_in === 0 && strm.avail_out === 0) {
        allowBufError = true;
      }
    } while ((strm.avail_in > 0 || strm.avail_out === 0) && status !== c.Z_STREAM_END);
    if (status === c.Z_STREAM_END) {
      _mode = c.Z_FINISH;
    }
    if (_mode === c.Z_FINISH) {
      status = zlib_inflate.inflateEnd(this.strm);
      this.onEnd(status);
      this.ended = true;
      return status === c.Z_OK;
    }
    if (_mode === c.Z_SYNC_FLUSH) {
      this.onEnd(c.Z_OK);
      strm.avail_out = 0;
      return true;
    }
    return true;
  };
  Inflate.prototype.onData = function(chunk) {
    this.chunks.push(chunk);
  };
  Inflate.prototype.onEnd = function(status) {
    if (status === c.Z_OK) {
      if (this.options.to === "string") {
        this.result = this.chunks.join("");
      } else {
        this.result = utils.flattenChunks(this.chunks);
      }
    }
    this.chunks = [];
    this.err = status;
    this.msg = this.strm.msg;
  };
  function inflate(input, options) {
    var inflator = new Inflate(options);
    inflator.push(input, true);
    if (inflator.err) {
      throw inflator.msg || msg[inflator.err];
    }
    return inflator.result;
  }
  function inflateRaw(input, options) {
    options = options || {};
    options.raw = true;
    return inflate(input, options);
  }
  exports.Inflate = Inflate;
  exports.inflate = inflate;
  exports.inflateRaw = inflateRaw;
  exports.ungzip = inflate;
});

// node_modules/pako/index.js
var require_pako = __commonJS((exports, module) => {
  var assign = require_common().assign;
  var deflate = require_deflate2();
  var inflate = require_inflate2();
  var constants2 = require_constants();
  var pako = {};
  assign(pako, deflate, inflate, constants2);
  module.exports = pako;
});

// node_modules/jszip/lib/flate.js
var require_flate = __commonJS((exports) => {
  var USE_TYPEDARRAY = typeof Uint8Array !== "undefined" && typeof Uint16Array !== "undefined" && typeof Uint32Array !== "undefined";
  var pako = require_pako();
  var utils = require_utils();
  var GenericWorker = require_GenericWorker();
  var ARRAY_TYPE = USE_TYPEDARRAY ? "uint8array" : "array";
  exports.magic = "\b\x00";
  function FlateWorker(action, options) {
    GenericWorker.call(this, "FlateWorker/" + action);
    this._pako = null;
    this._pakoAction = action;
    this._pakoOptions = options;
    this.meta = {};
  }
  utils.inherits(FlateWorker, GenericWorker);
  FlateWorker.prototype.processChunk = function(chunk) {
    this.meta = chunk.meta;
    if (this._pako === null) {
      this._createPako();
    }
    this._pako.push(utils.transformTo(ARRAY_TYPE, chunk.data), false);
  };
  FlateWorker.prototype.flush = function() {
    GenericWorker.prototype.flush.call(this);
    if (this._pako === null) {
      this._createPako();
    }
    this._pako.push([], true);
  };
  FlateWorker.prototype.cleanUp = function() {
    GenericWorker.prototype.cleanUp.call(this);
    this._pako = null;
  };
  FlateWorker.prototype._createPako = function() {
    this._pako = new pako[this._pakoAction]({
      raw: true,
      level: this._pakoOptions.level || -1
    });
    var self2 = this;
    this._pako.onData = function(data) {
      self2.push({
        data,
        meta: self2.meta
      });
    };
  };
  exports.compressWorker = function(compressionOptions) {
    return new FlateWorker("Deflate", compressionOptions);
  };
  exports.uncompressWorker = function() {
    return new FlateWorker("Inflate", {});
  };
});

// node_modules/jszip/lib/compressions.js
var require_compressions = __commonJS((exports) => {
  var GenericWorker = require_GenericWorker();
  exports.STORE = {
    magic: "\x00\x00",
    compressWorker: function() {
      return new GenericWorker("STORE compression");
    },
    uncompressWorker: function() {
      return new GenericWorker("STORE decompression");
    }
  };
  exports.DEFLATE = require_flate();
});

// node_modules/jszip/lib/signature.js
var require_signature = __commonJS((exports) => {
  exports.LOCAL_FILE_HEADER = "PK\x03\x04";
  exports.CENTRAL_FILE_HEADER = "PK\x01\x02";
  exports.CENTRAL_DIRECTORY_END = "PK\x05\x06";
  exports.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x06\x07";
  exports.ZIP64_CENTRAL_DIRECTORY_END = "PK\x06\x06";
  exports.DATA_DESCRIPTOR = "PK\x07\b";
});

// node_modules/jszip/lib/generate/ZipFileWorker.js
var require_ZipFileWorker = __commonJS((exports, module) => {
  var utils = require_utils();
  var GenericWorker = require_GenericWorker();
  var utf8 = require_utf8();
  var crc32 = require_crc32();
  var signature = require_signature();
  var decToHex = function(dec, bytes) {
    var hex = "", i2;
    for (i2 = 0;i2 < bytes; i2++) {
      hex += String.fromCharCode(dec & 255);
      dec = dec >>> 8;
    }
    return hex;
  };
  var generateUnixExternalFileAttr = function(unixPermissions, isDir) {
    var result = unixPermissions;
    if (!unixPermissions) {
      result = isDir ? 16893 : 33204;
    }
    return (result & 65535) << 16;
  };
  var generateDosExternalFileAttr = function(dosPermissions) {
    return (dosPermissions || 0) & 63;
  };
  var generateZipParts = function(streamInfo, streamedContent, streamingEnded, offset, platform, encodeFileName) {
    var file = streamInfo["file"], compression = streamInfo["compression"], useCustomEncoding = encodeFileName !== utf8.utf8encode, encodedFileName = utils.transformTo("string", encodeFileName(file.name)), utfEncodedFileName = utils.transformTo("string", utf8.utf8encode(file.name)), comment = file.comment, encodedComment = utils.transformTo("string", encodeFileName(comment)), utfEncodedComment = utils.transformTo("string", utf8.utf8encode(comment)), useUTF8ForFileName = utfEncodedFileName.length !== file.name.length, useUTF8ForComment = utfEncodedComment.length !== comment.length, dosTime, dosDate, extraFields = "", unicodePathExtraField = "", unicodeCommentExtraField = "", dir = file.dir, date = file.date;
    var dataInfo = {
      crc32: 0,
      compressedSize: 0,
      uncompressedSize: 0
    };
    if (!streamedContent || streamingEnded) {
      dataInfo.crc32 = streamInfo["crc32"];
      dataInfo.compressedSize = streamInfo["compressedSize"];
      dataInfo.uncompressedSize = streamInfo["uncompressedSize"];
    }
    var bitflag = 0;
    if (streamedContent) {
      bitflag |= 8;
    }
    if (!useCustomEncoding && (useUTF8ForFileName || useUTF8ForComment)) {
      bitflag |= 2048;
    }
    var extFileAttr = 0;
    var versionMadeBy = 0;
    if (dir) {
      extFileAttr |= 16;
    }
    if (platform === "UNIX") {
      versionMadeBy = 798;
      extFileAttr |= generateUnixExternalFileAttr(file.unixPermissions, dir);
    } else {
      versionMadeBy = 20;
      extFileAttr |= generateDosExternalFileAttr(file.dosPermissions, dir);
    }
    dosTime = date.getUTCHours();
    dosTime = dosTime << 6;
    dosTime = dosTime | date.getUTCMinutes();
    dosTime = dosTime << 5;
    dosTime = dosTime | date.getUTCSeconds() / 2;
    dosDate = date.getUTCFullYear() - 1980;
    dosDate = dosDate << 4;
    dosDate = dosDate | date.getUTCMonth() + 1;
    dosDate = dosDate << 5;
    dosDate = dosDate | date.getUTCDate();
    if (useUTF8ForFileName) {
      unicodePathExtraField = decToHex(1, 1) + decToHex(crc32(encodedFileName), 4) + utfEncodedFileName;
      extraFields += "up" + decToHex(unicodePathExtraField.length, 2) + unicodePathExtraField;
    }
    if (useUTF8ForComment) {
      unicodeCommentExtraField = decToHex(1, 1) + decToHex(crc32(encodedComment), 4) + utfEncodedComment;
      extraFields += "uc" + decToHex(unicodeCommentExtraField.length, 2) + unicodeCommentExtraField;
    }
    var header = "";
    header += `
\x00`;
    header += decToHex(bitflag, 2);
    header += compression.magic;
    header += decToHex(dosTime, 2);
    header += decToHex(dosDate, 2);
    header += decToHex(dataInfo.crc32, 4);
    header += decToHex(dataInfo.compressedSize, 4);
    header += decToHex(dataInfo.uncompressedSize, 4);
    header += decToHex(encodedFileName.length, 2);
    header += decToHex(extraFields.length, 2);
    var fileRecord = signature.LOCAL_FILE_HEADER + header + encodedFileName + extraFields;
    var dirRecord = signature.CENTRAL_FILE_HEADER + decToHex(versionMadeBy, 2) + header + decToHex(encodedComment.length, 2) + "\x00\x00" + "\x00\x00" + decToHex(extFileAttr, 4) + decToHex(offset, 4) + encodedFileName + extraFields + encodedComment;
    return {
      fileRecord,
      dirRecord
    };
  };
  var generateCentralDirectoryEnd = function(entriesCount, centralDirLength, localDirLength, comment, encodeFileName) {
    var dirEnd = "";
    var encodedComment = utils.transformTo("string", encodeFileName(comment));
    dirEnd = signature.CENTRAL_DIRECTORY_END + "\x00\x00" + "\x00\x00" + decToHex(entriesCount, 2) + decToHex(entriesCount, 2) + decToHex(centralDirLength, 4) + decToHex(localDirLength, 4) + decToHex(encodedComment.length, 2) + encodedComment;
    return dirEnd;
  };
  var generateDataDescriptors = function(streamInfo) {
    var descriptor = "";
    descriptor = signature.DATA_DESCRIPTOR + decToHex(streamInfo["crc32"], 4) + decToHex(streamInfo["compressedSize"], 4) + decToHex(streamInfo["uncompressedSize"], 4);
    return descriptor;
  };
  function ZipFileWorker(streamFiles, comment, platform, encodeFileName) {
    GenericWorker.call(this, "ZipFileWorker");
    this.bytesWritten = 0;
    this.zipComment = comment;
    this.zipPlatform = platform;
    this.encodeFileName = encodeFileName;
    this.streamFiles = streamFiles;
    this.accumulate = false;
    this.contentBuffer = [];
    this.dirRecords = [];
    this.currentSourceOffset = 0;
    this.entriesCount = 0;
    this.currentFile = null;
    this._sources = [];
  }
  utils.inherits(ZipFileWorker, GenericWorker);
  ZipFileWorker.prototype.push = function(chunk) {
    var currentFilePercent = chunk.meta.percent || 0;
    var entriesCount = this.entriesCount;
    var remainingFiles = this._sources.length;
    if (this.accumulate) {
      this.contentBuffer.push(chunk);
    } else {
      this.bytesWritten += chunk.data.length;
      GenericWorker.prototype.push.call(this, {
        data: chunk.data,
        meta: {
          currentFile: this.currentFile,
          percent: entriesCount ? (currentFilePercent + 100 * (entriesCount - remainingFiles - 1)) / entriesCount : 100
        }
      });
    }
  };
  ZipFileWorker.prototype.openedSource = function(streamInfo) {
    this.currentSourceOffset = this.bytesWritten;
    this.currentFile = streamInfo["file"].name;
    var streamedContent = this.streamFiles && !streamInfo["file"].dir;
    if (streamedContent) {
      var record = generateZipParts(streamInfo, streamedContent, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
      this.push({
        data: record.fileRecord,
        meta: { percent: 0 }
      });
    } else {
      this.accumulate = true;
    }
  };
  ZipFileWorker.prototype.closedSource = function(streamInfo) {
    this.accumulate = false;
    var streamedContent = this.streamFiles && !streamInfo["file"].dir;
    var record = generateZipParts(streamInfo, streamedContent, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
    this.dirRecords.push(record.dirRecord);
    if (streamedContent) {
      this.push({
        data: generateDataDescriptors(streamInfo),
        meta: { percent: 100 }
      });
    } else {
      this.push({
        data: record.fileRecord,
        meta: { percent: 0 }
      });
      while (this.contentBuffer.length) {
        this.push(this.contentBuffer.shift());
      }
    }
    this.currentFile = null;
  };
  ZipFileWorker.prototype.flush = function() {
    var localDirLength = this.bytesWritten;
    for (var i2 = 0;i2 < this.dirRecords.length; i2++) {
      this.push({
        data: this.dirRecords[i2],
        meta: { percent: 100 }
      });
    }
    var centralDirLength = this.bytesWritten - localDirLength;
    var dirEnd = generateCentralDirectoryEnd(this.dirRecords.length, centralDirLength, localDirLength, this.zipComment, this.encodeFileName);
    this.push({
      data: dirEnd,
      meta: { percent: 100 }
    });
  };
  ZipFileWorker.prototype.prepareNextSource = function() {
    this.previous = this._sources.shift();
    this.openedSource(this.previous.streamInfo);
    if (this.isPaused) {
      this.previous.pause();
    } else {
      this.previous.resume();
    }
  };
  ZipFileWorker.prototype.registerPrevious = function(previous) {
    this._sources.push(previous);
    var self2 = this;
    previous.on("data", function(chunk) {
      self2.processChunk(chunk);
    });
    previous.on("end", function() {
      self2.closedSource(self2.previous.streamInfo);
      if (self2._sources.length) {
        self2.prepareNextSource();
      } else {
        self2.end();
      }
    });
    previous.on("error", function(e) {
      self2.error(e);
    });
    return this;
  };
  ZipFileWorker.prototype.resume = function() {
    if (!GenericWorker.prototype.resume.call(this)) {
      return false;
    }
    if (!this.previous && this._sources.length) {
      this.prepareNextSource();
      return true;
    }
    if (!this.previous && !this._sources.length && !this.generatedError) {
      this.end();
      return true;
    }
  };
  ZipFileWorker.prototype.error = function(e) {
    var sources = this._sources;
    if (!GenericWorker.prototype.error.call(this, e)) {
      return false;
    }
    for (var i2 = 0;i2 < sources.length; i2++) {
      try {
        sources[i2].error(e);
      } catch (e2) {}
    }
    return true;
  };
  ZipFileWorker.prototype.lock = function() {
    GenericWorker.prototype.lock.call(this);
    var sources = this._sources;
    for (var i2 = 0;i2 < sources.length; i2++) {
      sources[i2].lock();
    }
  };
  module.exports = ZipFileWorker;
});

// node_modules/jszip/lib/generate/index.js
var require_generate = __commonJS((exports) => {
  var compressions = require_compressions();
  var ZipFileWorker = require_ZipFileWorker();
  var getCompression = function(fileCompression, zipCompression) {
    var compressionName = fileCompression || zipCompression;
    var compression = compressions[compressionName];
    if (!compression) {
      throw new Error(compressionName + " is not a valid compression method !");
    }
    return compression;
  };
  exports.generateWorker = function(zip, options, comment) {
    var zipFileWorker = new ZipFileWorker(options.streamFiles, comment, options.platform, options.encodeFileName);
    var entriesCount = 0;
    try {
      zip.forEach(function(relativePath, file) {
        entriesCount++;
        var compression = getCompression(file.options.compression, options.compression);
        var compressionOptions = file.options.compressionOptions || options.compressionOptions || {};
        var { dir, date } = file;
        file._compressWorker(compression, compressionOptions).withStreamInfo("file", {
          name: relativePath,
          dir,
          date,
          comment: file.comment || "",
          unixPermissions: file.unixPermissions,
          dosPermissions: file.dosPermissions
        }).pipe(zipFileWorker);
      });
      zipFileWorker.entriesCount = entriesCount;
    } catch (e) {
      zipFileWorker.error(e);
    }
    return zipFileWorker;
  };
});

// node_modules/jszip/lib/nodejs/NodejsStreamInputAdapter.js
var require_NodejsStreamInputAdapter = __commonJS((exports, module) => {
  var utils = require_utils();
  var GenericWorker = require_GenericWorker();
  function NodejsStreamInputAdapter(filename, stream) {
    GenericWorker.call(this, "Nodejs stream input adapter for " + filename);
    this._upstreamEnded = false;
    this._bindStream(stream);
  }
  utils.inherits(NodejsStreamInputAdapter, GenericWorker);
  NodejsStreamInputAdapter.prototype._bindStream = function(stream) {
    var self2 = this;
    this._stream = stream;
    stream.pause();
    stream.on("data", function(chunk) {
      self2.push({
        data: chunk,
        meta: {
          percent: 0
        }
      });
    }).on("error", function(e) {
      if (self2.isPaused) {
        this.generatedError = e;
      } else {
        self2.error(e);
      }
    }).on("end", function() {
      if (self2.isPaused) {
        self2._upstreamEnded = true;
      } else {
        self2.end();
      }
    });
  };
  NodejsStreamInputAdapter.prototype.pause = function() {
    if (!GenericWorker.prototype.pause.call(this)) {
      return false;
    }
    this._stream.pause();
    return true;
  };
  NodejsStreamInputAdapter.prototype.resume = function() {
    if (!GenericWorker.prototype.resume.call(this)) {
      return false;
    }
    if (this._upstreamEnded) {
      this.end();
    } else {
      this._stream.resume();
    }
    return true;
  };
  module.exports = NodejsStreamInputAdapter;
});

// node_modules/jszip/lib/object.js
var require_object = __commonJS((exports, module) => {
  var utf8 = require_utf8();
  var utils = require_utils();
  var GenericWorker = require_GenericWorker();
  var StreamHelper = require_StreamHelper();
  var defaults = require_defaults();
  var CompressedObject = require_compressedObject();
  var ZipObject = require_zipObject();
  var generate = require_generate();
  var nodejsUtils = require_nodejsUtils();
  var NodejsStreamInputAdapter = require_NodejsStreamInputAdapter();
  var fileAdd = function(name, data, originalOptions) {
    var dataType = utils.getTypeOf(data), parent;
    var o = utils.extend(originalOptions || {}, defaults);
    o.date = o.date || new Date;
    if (o.compression !== null) {
      o.compression = o.compression.toUpperCase();
    }
    if (typeof o.unixPermissions === "string") {
      o.unixPermissions = parseInt(o.unixPermissions, 8);
    }
    if (o.unixPermissions && o.unixPermissions & 16384) {
      o.dir = true;
    }
    if (o.dosPermissions && o.dosPermissions & 16) {
      o.dir = true;
    }
    if (o.dir) {
      name = forceTrailingSlash(name);
    }
    if (o.createFolders && (parent = parentFolder(name))) {
      folderAdd.call(this, parent, true);
    }
    var isUnicodeString = dataType === "string" && o.binary === false && o.base64 === false;
    if (!originalOptions || typeof originalOptions.binary === "undefined") {
      o.binary = !isUnicodeString;
    }
    var isCompressedEmpty = data instanceof CompressedObject && data.uncompressedSize === 0;
    if (isCompressedEmpty || o.dir || !data || data.length === 0) {
      o.base64 = false;
      o.binary = true;
      data = "";
      o.compression = "STORE";
      dataType = "string";
    }
    var zipObjectContent = null;
    if (data instanceof CompressedObject || data instanceof GenericWorker) {
      zipObjectContent = data;
    } else if (nodejsUtils.isNode && nodejsUtils.isStream(data)) {
      zipObjectContent = new NodejsStreamInputAdapter(name, data);
    } else {
      zipObjectContent = utils.prepareContent(name, data, o.binary, o.optimizedBinaryString, o.base64);
    }
    var object = new ZipObject(name, zipObjectContent, o);
    this.files[name] = object;
  };
  var parentFolder = function(path) {
    if (path.slice(-1) === "/") {
      path = path.substring(0, path.length - 1);
    }
    var lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.substring(0, lastSlash) : "";
  };
  var forceTrailingSlash = function(path) {
    if (path.slice(-1) !== "/") {
      path += "/";
    }
    return path;
  };
  var folderAdd = function(name, createFolders) {
    createFolders = typeof createFolders !== "undefined" ? createFolders : defaults.createFolders;
    name = forceTrailingSlash(name);
    if (!this.files[name]) {
      fileAdd.call(this, name, null, {
        dir: true,
        createFolders
      });
    }
    return this.files[name];
  };
  function isRegExp(object) {
    return Object.prototype.toString.call(object) === "[object RegExp]";
  }
  var out = {
    load: function() {
      throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
    },
    forEach: function(cb) {
      var filename, relativePath, file;
      for (filename in this.files) {
        file = this.files[filename];
        relativePath = filename.slice(this.root.length, filename.length);
        if (relativePath && filename.slice(0, this.root.length) === this.root) {
          cb(relativePath, file);
        }
      }
    },
    filter: function(search) {
      var result = [];
      this.forEach(function(relativePath, entry) {
        if (search(relativePath, entry)) {
          result.push(entry);
        }
      });
      return result;
    },
    file: function(name, data, o) {
      if (arguments.length === 1) {
        if (isRegExp(name)) {
          var regexp = name;
          return this.filter(function(relativePath, file) {
            return !file.dir && regexp.test(relativePath);
          });
        } else {
          var obj = this.files[this.root + name];
          if (obj && !obj.dir) {
            return obj;
          } else {
            return null;
          }
        }
      } else {
        name = this.root + name;
        fileAdd.call(this, name, data, o);
      }
      return this;
    },
    folder: function(arg) {
      if (!arg) {
        return this;
      }
      if (isRegExp(arg)) {
        return this.filter(function(relativePath, file) {
          return file.dir && arg.test(relativePath);
        });
      }
      var name = this.root + arg;
      var newFolder = folderAdd.call(this, name);
      var ret = this.clone();
      ret.root = newFolder.name;
      return ret;
    },
    remove: function(name) {
      name = this.root + name;
      var file = this.files[name];
      if (!file) {
        if (name.slice(-1) !== "/") {
          name += "/";
        }
        file = this.files[name];
      }
      if (file && !file.dir) {
        delete this.files[name];
      } else {
        var kids = this.filter(function(relativePath, file2) {
          return file2.name.slice(0, name.length) === name;
        });
        for (var i2 = 0;i2 < kids.length; i2++) {
          delete this.files[kids[i2].name];
        }
      }
      return this;
    },
    generate: function() {
      throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
    },
    generateInternalStream: function(options) {
      var worker, opts = {};
      try {
        opts = utils.extend(options || {}, {
          streamFiles: false,
          compression: "STORE",
          compressionOptions: null,
          type: "",
          platform: "DOS",
          comment: null,
          mimeType: "application/zip",
          encodeFileName: utf8.utf8encode
        });
        opts.type = opts.type.toLowerCase();
        opts.compression = opts.compression.toUpperCase();
        if (opts.type === "binarystring") {
          opts.type = "string";
        }
        if (!opts.type) {
          throw new Error("No output type specified.");
        }
        utils.checkSupport(opts.type);
        if (opts.platform === "darwin" || opts.platform === "freebsd" || opts.platform === "linux" || opts.platform === "sunos") {
          opts.platform = "UNIX";
        }
        if (opts.platform === "win32") {
          opts.platform = "DOS";
        }
        var comment = opts.comment || this.comment || "";
        worker = generate.generateWorker(this, opts, comment);
      } catch (e) {
        worker = new GenericWorker("error");
        worker.error(e);
      }
      return new StreamHelper(worker, opts.type || "string", opts.mimeType);
    },
    generateAsync: function(options, onUpdate) {
      return this.generateInternalStream(options).accumulate(onUpdate);
    },
    generateNodeStream: function(options, onUpdate) {
      options = options || {};
      if (!options.type) {
        options.type = "nodebuffer";
      }
      return this.generateInternalStream(options).toNodejsStream(onUpdate);
    }
  };
  module.exports = out;
});

// node_modules/jszip/lib/reader/DataReader.js
var require_DataReader = __commonJS((exports, module) => {
  var utils = require_utils();
  function DataReader(data) {
    this.data = data;
    this.length = data.length;
    this.index = 0;
    this.zero = 0;
  }
  DataReader.prototype = {
    checkOffset: function(offset) {
      this.checkIndex(this.index + offset);
    },
    checkIndex: function(newIndex) {
      if (this.length < this.zero + newIndex || newIndex < 0) {
        throw new Error("End of data reached (data length = " + this.length + ", asked index = " + newIndex + "). Corrupted zip ?");
      }
    },
    setIndex: function(newIndex) {
      this.checkIndex(newIndex);
      this.index = newIndex;
    },
    skip: function(n) {
      this.setIndex(this.index + n);
    },
    byteAt: function() {},
    readInt: function(size) {
      var result = 0, i2;
      this.checkOffset(size);
      for (i2 = this.index + size - 1;i2 >= this.index; i2--) {
        result = (result << 8) + this.byteAt(i2);
      }
      this.index += size;
      return result;
    },
    readString: function(size) {
      return utils.transformTo("string", this.readData(size));
    },
    readData: function() {},
    lastIndexOfSignature: function() {},
    readAndCheckSignature: function() {},
    readDate: function() {
      var dostime = this.readInt(4);
      return new Date(Date.UTC((dostime >> 25 & 127) + 1980, (dostime >> 21 & 15) - 1, dostime >> 16 & 31, dostime >> 11 & 31, dostime >> 5 & 63, (dostime & 31) << 1));
    }
  };
  module.exports = DataReader;
});

// node_modules/jszip/lib/reader/ArrayReader.js
var require_ArrayReader = __commonJS((exports, module) => {
  var DataReader = require_DataReader();
  var utils = require_utils();
  function ArrayReader(data) {
    DataReader.call(this, data);
    for (var i2 = 0;i2 < this.data.length; i2++) {
      data[i2] = data[i2] & 255;
    }
  }
  utils.inherits(ArrayReader, DataReader);
  ArrayReader.prototype.byteAt = function(i2) {
    return this.data[this.zero + i2];
  };
  ArrayReader.prototype.lastIndexOfSignature = function(sig) {
    var sig0 = sig.charCodeAt(0), sig1 = sig.charCodeAt(1), sig2 = sig.charCodeAt(2), sig3 = sig.charCodeAt(3);
    for (var i2 = this.length - 4;i2 >= 0; --i2) {
      if (this.data[i2] === sig0 && this.data[i2 + 1] === sig1 && this.data[i2 + 2] === sig2 && this.data[i2 + 3] === sig3) {
        return i2 - this.zero;
      }
    }
    return -1;
  };
  ArrayReader.prototype.readAndCheckSignature = function(sig) {
    var sig0 = sig.charCodeAt(0), sig1 = sig.charCodeAt(1), sig2 = sig.charCodeAt(2), sig3 = sig.charCodeAt(3), data = this.readData(4);
    return sig0 === data[0] && sig1 === data[1] && sig2 === data[2] && sig3 === data[3];
  };
  ArrayReader.prototype.readData = function(size) {
    this.checkOffset(size);
    if (size === 0) {
      return [];
    }
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
  };
  module.exports = ArrayReader;
});

// node_modules/jszip/lib/reader/StringReader.js
var require_StringReader = __commonJS((exports, module) => {
  var DataReader = require_DataReader();
  var utils = require_utils();
  function StringReader(data) {
    DataReader.call(this, data);
  }
  utils.inherits(StringReader, DataReader);
  StringReader.prototype.byteAt = function(i2) {
    return this.data.charCodeAt(this.zero + i2);
  };
  StringReader.prototype.lastIndexOfSignature = function(sig) {
    return this.data.lastIndexOf(sig) - this.zero;
  };
  StringReader.prototype.readAndCheckSignature = function(sig) {
    var data = this.readData(4);
    return sig === data;
  };
  StringReader.prototype.readData = function(size) {
    this.checkOffset(size);
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
  };
  module.exports = StringReader;
});

// node_modules/jszip/lib/reader/Uint8ArrayReader.js
var require_Uint8ArrayReader = __commonJS((exports, module) => {
  var ArrayReader = require_ArrayReader();
  var utils = require_utils();
  function Uint8ArrayReader(data) {
    ArrayReader.call(this, data);
  }
  utils.inherits(Uint8ArrayReader, ArrayReader);
  Uint8ArrayReader.prototype.readData = function(size) {
    this.checkOffset(size);
    if (size === 0) {
      return new Uint8Array(0);
    }
    var result = this.data.subarray(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
  };
  module.exports = Uint8ArrayReader;
});

// node_modules/jszip/lib/reader/NodeBufferReader.js
var require_NodeBufferReader = __commonJS((exports, module) => {
  var Uint8ArrayReader = require_Uint8ArrayReader();
  var utils = require_utils();
  function NodeBufferReader(data) {
    Uint8ArrayReader.call(this, data);
  }
  utils.inherits(NodeBufferReader, Uint8ArrayReader);
  NodeBufferReader.prototype.readData = function(size) {
    this.checkOffset(size);
    var result = this.data.slice(this.zero + this.index, this.zero + this.index + size);
    this.index += size;
    return result;
  };
  module.exports = NodeBufferReader;
});

// node_modules/jszip/lib/reader/readerFor.js
var require_readerFor = __commonJS((exports, module) => {
  var utils = require_utils();
  var support = require_support();
  var ArrayReader = require_ArrayReader();
  var StringReader = require_StringReader();
  var NodeBufferReader = require_NodeBufferReader();
  var Uint8ArrayReader = require_Uint8ArrayReader();
  module.exports = function(data) {
    var type = utils.getTypeOf(data);
    utils.checkSupport(type);
    if (type === "string" && !support.uint8array) {
      return new StringReader(data);
    }
    if (type === "nodebuffer") {
      return new NodeBufferReader(data);
    }
    if (support.uint8array) {
      return new Uint8ArrayReader(utils.transformTo("uint8array", data));
    }
    return new ArrayReader(utils.transformTo("array", data));
  };
});

// node_modules/jszip/lib/zipEntry.js
var require_zipEntry = __commonJS((exports, module) => {
  var readerFor = require_readerFor();
  var utils = require_utils();
  var CompressedObject = require_compressedObject();
  var crc32fn = require_crc32();
  var utf8 = require_utf8();
  var compressions = require_compressions();
  var support = require_support();
  var MADE_BY_DOS = 0;
  var MADE_BY_UNIX = 3;
  var findCompression = function(compressionMethod) {
    for (var method in compressions) {
      if (!Object.prototype.hasOwnProperty.call(compressions, method)) {
        continue;
      }
      if (compressions[method].magic === compressionMethod) {
        return compressions[method];
      }
    }
    return null;
  };
  function ZipEntry(options, loadOptions) {
    this.options = options;
    this.loadOptions = loadOptions;
  }
  ZipEntry.prototype = {
    isEncrypted: function() {
      return (this.bitFlag & 1) === 1;
    },
    useUTF8: function() {
      return (this.bitFlag & 2048) === 2048;
    },
    readLocalPart: function(reader) {
      var compression, localExtraFieldsLength;
      reader.skip(22);
      this.fileNameLength = reader.readInt(2);
      localExtraFieldsLength = reader.readInt(2);
      this.fileName = reader.readData(this.fileNameLength);
      reader.skip(localExtraFieldsLength);
      if (this.compressedSize === -1 || this.uncompressedSize === -1) {
        throw new Error("Bug or corrupted zip : didn't get enough information from the central directory " + "(compressedSize === -1 || uncompressedSize === -1)");
      }
      compression = findCompression(this.compressionMethod);
      if (compression === null) {
        throw new Error("Corrupted zip : compression " + utils.pretty(this.compressionMethod) + " unknown (inner file : " + utils.transformTo("string", this.fileName) + ")");
      }
      this.decompressed = new CompressedObject(this.compressedSize, this.uncompressedSize, this.crc32, compression, reader.readData(this.compressedSize));
    },
    readCentralPart: function(reader) {
      this.versionMadeBy = reader.readInt(2);
      reader.skip(2);
      this.bitFlag = reader.readInt(2);
      this.compressionMethod = reader.readString(2);
      this.date = reader.readDate();
      this.crc32 = reader.readInt(4);
      this.compressedSize = reader.readInt(4);
      this.uncompressedSize = reader.readInt(4);
      var fileNameLength = reader.readInt(2);
      this.extraFieldsLength = reader.readInt(2);
      this.fileCommentLength = reader.readInt(2);
      this.diskNumberStart = reader.readInt(2);
      this.internalFileAttributes = reader.readInt(2);
      this.externalFileAttributes = reader.readInt(4);
      this.localHeaderOffset = reader.readInt(4);
      if (this.isEncrypted()) {
        throw new Error("Encrypted zip are not supported");
      }
      reader.skip(fileNameLength);
      this.readExtraFields(reader);
      this.parseZIP64ExtraField(reader);
      this.fileComment = reader.readData(this.fileCommentLength);
    },
    processAttributes: function() {
      this.unixPermissions = null;
      this.dosPermissions = null;
      var madeBy = this.versionMadeBy >> 8;
      this.dir = this.externalFileAttributes & 16 ? true : false;
      if (madeBy === MADE_BY_DOS) {
        this.dosPermissions = this.externalFileAttributes & 63;
      }
      if (madeBy === MADE_BY_UNIX) {
        this.unixPermissions = this.externalFileAttributes >> 16 & 65535;
      }
      if (!this.dir && this.fileNameStr.slice(-1) === "/") {
        this.dir = true;
      }
    },
    parseZIP64ExtraField: function() {
      if (!this.extraFields[1]) {
        return;
      }
      var extraReader = readerFor(this.extraFields[1].value);
      if (this.uncompressedSize === utils.MAX_VALUE_32BITS) {
        this.uncompressedSize = extraReader.readInt(8);
      }
      if (this.compressedSize === utils.MAX_VALUE_32BITS) {
        this.compressedSize = extraReader.readInt(8);
      }
      if (this.localHeaderOffset === utils.MAX_VALUE_32BITS) {
        this.localHeaderOffset = extraReader.readInt(8);
      }
      if (this.diskNumberStart === utils.MAX_VALUE_32BITS) {
        this.diskNumberStart = extraReader.readInt(4);
      }
    },
    readExtraFields: function(reader) {
      var end = reader.index + this.extraFieldsLength, extraFieldId, extraFieldLength, extraFieldValue;
      if (!this.extraFields) {
        this.extraFields = {};
      }
      while (reader.index + 4 < end) {
        extraFieldId = reader.readInt(2);
        extraFieldLength = reader.readInt(2);
        extraFieldValue = reader.readData(extraFieldLength);
        this.extraFields[extraFieldId] = {
          id: extraFieldId,
          length: extraFieldLength,
          value: extraFieldValue
        };
      }
      reader.setIndex(end);
    },
    handleUTF8: function() {
      var decodeParamType = support.uint8array ? "uint8array" : "array";
      if (this.useUTF8()) {
        this.fileNameStr = utf8.utf8decode(this.fileName);
        this.fileCommentStr = utf8.utf8decode(this.fileComment);
      } else {
        var upath = this.findExtraFieldUnicodePath();
        if (upath !== null) {
          this.fileNameStr = upath;
        } else {
          var fileNameByteArray = utils.transformTo(decodeParamType, this.fileName);
          this.fileNameStr = this.loadOptions.decodeFileName(fileNameByteArray);
        }
        var ucomment = this.findExtraFieldUnicodeComment();
        if (ucomment !== null) {
          this.fileCommentStr = ucomment;
        } else {
          var commentByteArray = utils.transformTo(decodeParamType, this.fileComment);
          this.fileCommentStr = this.loadOptions.decodeFileName(commentByteArray);
        }
      }
    },
    findExtraFieldUnicodePath: function() {
      var upathField = this.extraFields[28789];
      if (upathField) {
        var extraReader = readerFor(upathField.value);
        if (extraReader.readInt(1) !== 1) {
          return null;
        }
        if (crc32fn(this.fileName) !== extraReader.readInt(4)) {
          return null;
        }
        return utf8.utf8decode(extraReader.readData(upathField.length - 5));
      }
      return null;
    },
    findExtraFieldUnicodeComment: function() {
      var ucommentField = this.extraFields[25461];
      if (ucommentField) {
        var extraReader = readerFor(ucommentField.value);
        if (extraReader.readInt(1) !== 1) {
          return null;
        }
        if (crc32fn(this.fileComment) !== extraReader.readInt(4)) {
          return null;
        }
        return utf8.utf8decode(extraReader.readData(ucommentField.length - 5));
      }
      return null;
    }
  };
  module.exports = ZipEntry;
});

// node_modules/jszip/lib/zipEntries.js
var require_zipEntries = __commonJS((exports, module) => {
  var readerFor = require_readerFor();
  var utils = require_utils();
  var sig = require_signature();
  var ZipEntry = require_zipEntry();
  var support = require_support();
  function ZipEntries(loadOptions) {
    this.files = [];
    this.loadOptions = loadOptions;
  }
  ZipEntries.prototype = {
    checkSignature: function(expectedSignature) {
      if (!this.reader.readAndCheckSignature(expectedSignature)) {
        this.reader.index -= 4;
        var signature = this.reader.readString(4);
        throw new Error("Corrupted zip or bug: unexpected signature " + "(" + utils.pretty(signature) + ", expected " + utils.pretty(expectedSignature) + ")");
      }
    },
    isSignature: function(askedIndex, expectedSignature) {
      var currentIndex = this.reader.index;
      this.reader.setIndex(askedIndex);
      var signature = this.reader.readString(4);
      var result = signature === expectedSignature;
      this.reader.setIndex(currentIndex);
      return result;
    },
    readBlockEndOfCentral: function() {
      this.diskNumber = this.reader.readInt(2);
      this.diskWithCentralDirStart = this.reader.readInt(2);
      this.centralDirRecordsOnThisDisk = this.reader.readInt(2);
      this.centralDirRecords = this.reader.readInt(2);
      this.centralDirSize = this.reader.readInt(4);
      this.centralDirOffset = this.reader.readInt(4);
      this.zipCommentLength = this.reader.readInt(2);
      var zipComment = this.reader.readData(this.zipCommentLength);
      var decodeParamType = support.uint8array ? "uint8array" : "array";
      var decodeContent = utils.transformTo(decodeParamType, zipComment);
      this.zipComment = this.loadOptions.decodeFileName(decodeContent);
    },
    readBlockZip64EndOfCentral: function() {
      this.zip64EndOfCentralSize = this.reader.readInt(8);
      this.reader.skip(4);
      this.diskNumber = this.reader.readInt(4);
      this.diskWithCentralDirStart = this.reader.readInt(4);
      this.centralDirRecordsOnThisDisk = this.reader.readInt(8);
      this.centralDirRecords = this.reader.readInt(8);
      this.centralDirSize = this.reader.readInt(8);
      this.centralDirOffset = this.reader.readInt(8);
      this.zip64ExtensibleData = {};
      var extraDataSize = this.zip64EndOfCentralSize - 44, index = 0, extraFieldId, extraFieldLength, extraFieldValue;
      while (index < extraDataSize) {
        extraFieldId = this.reader.readInt(2);
        extraFieldLength = this.reader.readInt(4);
        extraFieldValue = this.reader.readData(extraFieldLength);
        this.zip64ExtensibleData[extraFieldId] = {
          id: extraFieldId,
          length: extraFieldLength,
          value: extraFieldValue
        };
      }
    },
    readBlockZip64EndOfCentralLocator: function() {
      this.diskWithZip64CentralDirStart = this.reader.readInt(4);
      this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8);
      this.disksCount = this.reader.readInt(4);
      if (this.disksCount > 1) {
        throw new Error("Multi-volumes zip are not supported");
      }
    },
    readLocalFiles: function() {
      var i2, file;
      for (i2 = 0;i2 < this.files.length; i2++) {
        file = this.files[i2];
        this.reader.setIndex(file.localHeaderOffset);
        this.checkSignature(sig.LOCAL_FILE_HEADER);
        file.readLocalPart(this.reader);
        file.handleUTF8();
        file.processAttributes();
      }
    },
    readCentralDir: function() {
      var file;
      this.reader.setIndex(this.centralDirOffset);
      while (this.reader.readAndCheckSignature(sig.CENTRAL_FILE_HEADER)) {
        file = new ZipEntry({
          zip64: this.zip64
        }, this.loadOptions);
        file.readCentralPart(this.reader);
        this.files.push(file);
      }
      if (this.centralDirRecords !== this.files.length) {
        if (this.centralDirRecords !== 0 && this.files.length === 0) {
          throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
        } else {}
      }
    },
    readEndOfCentral: function() {
      var offset = this.reader.lastIndexOfSignature(sig.CENTRAL_DIRECTORY_END);
      if (offset < 0) {
        var isGarbage = !this.isSignature(0, sig.LOCAL_FILE_HEADER);
        if (isGarbage) {
          throw new Error("Can't find end of central directory : is this a zip file ? " + "If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html");
        } else {
          throw new Error("Corrupted zip: can't find end of central directory");
        }
      }
      this.reader.setIndex(offset);
      var endOfCentralDirOffset = offset;
      this.checkSignature(sig.CENTRAL_DIRECTORY_END);
      this.readBlockEndOfCentral();
      if (this.diskNumber === utils.MAX_VALUE_16BITS || this.diskWithCentralDirStart === utils.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === utils.MAX_VALUE_16BITS || this.centralDirRecords === utils.MAX_VALUE_16BITS || this.centralDirSize === utils.MAX_VALUE_32BITS || this.centralDirOffset === utils.MAX_VALUE_32BITS) {
        this.zip64 = true;
        offset = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
        if (offset < 0) {
          throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
        }
        this.reader.setIndex(offset);
        this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_LOCATOR);
        this.readBlockZip64EndOfCentralLocator();
        if (!this.isSignature(this.relativeOffsetEndOfZip64CentralDir, sig.ZIP64_CENTRAL_DIRECTORY_END)) {
          this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
          if (this.relativeOffsetEndOfZip64CentralDir < 0) {
            throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
          }
        }
        this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir);
        this.checkSignature(sig.ZIP64_CENTRAL_DIRECTORY_END);
        this.readBlockZip64EndOfCentral();
      }
      var expectedEndOfCentralDirOffset = this.centralDirOffset + this.centralDirSize;
      if (this.zip64) {
        expectedEndOfCentralDirOffset += 20;
        expectedEndOfCentralDirOffset += 12 + this.zip64EndOfCentralSize;
      }
      var extraBytes = endOfCentralDirOffset - expectedEndOfCentralDirOffset;
      if (extraBytes > 0) {
        if (this.isSignature(endOfCentralDirOffset, sig.CENTRAL_FILE_HEADER)) {} else {
          this.reader.zero = extraBytes;
        }
      } else if (extraBytes < 0) {
        throw new Error("Corrupted zip: missing " + Math.abs(extraBytes) + " bytes.");
      }
    },
    prepareReader: function(data) {
      this.reader = readerFor(data);
    },
    load: function(data) {
      this.prepareReader(data);
      this.readEndOfCentral();
      this.readCentralDir();
      this.readLocalFiles();
    }
  };
  module.exports = ZipEntries;
});

// node_modules/jszip/lib/load.js
var require_load = __commonJS((exports, module) => {
  var utils = require_utils();
  var external = require_external();
  var utf8 = require_utf8();
  var ZipEntries = require_zipEntries();
  var Crc32Probe = require_Crc32Probe();
  var nodejsUtils = require_nodejsUtils();
  function checkEntryCRC32(zipEntry) {
    return new external.Promise(function(resolve, reject) {
      var worker = zipEntry.decompressed.getContentWorker().pipe(new Crc32Probe);
      worker.on("error", function(e) {
        reject(e);
      }).on("end", function() {
        if (worker.streamInfo.crc32 !== zipEntry.decompressed.crc32) {
          reject(new Error("Corrupted zip : CRC32 mismatch"));
        } else {
          resolve();
        }
      }).resume();
    });
  }
  module.exports = function(data, options) {
    var zip = this;
    options = utils.extend(options || {}, {
      base64: false,
      checkCRC32: false,
      optimizedBinaryString: false,
      createFolders: false,
      decodeFileName: utf8.utf8decode
    });
    if (nodejsUtils.isNode && nodejsUtils.isStream(data)) {
      return external.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file."));
    }
    return utils.prepareContent("the loaded zip file", data, true, options.optimizedBinaryString, options.base64).then(function(data2) {
      var zipEntries = new ZipEntries(options);
      zipEntries.load(data2);
      return zipEntries;
    }).then(function checkCRC32(zipEntries) {
      var promises = [external.Promise.resolve(zipEntries)];
      var files = zipEntries.files;
      if (options.checkCRC32) {
        for (var i2 = 0;i2 < files.length; i2++) {
          promises.push(checkEntryCRC32(files[i2]));
        }
      }
      return external.Promise.all(promises);
    }).then(function addFiles(results) {
      var zipEntries = results.shift();
      var files = zipEntries.files;
      for (var i2 = 0;i2 < files.length; i2++) {
        var input = files[i2];
        var unsafeName = input.fileNameStr;
        var safeName = utils.resolve(input.fileNameStr);
        zip.file(safeName, input.decompressed, {
          binary: true,
          optimizedBinaryString: true,
          date: input.date,
          dir: input.dir,
          comment: input.fileCommentStr.length ? input.fileCommentStr : null,
          unixPermissions: input.unixPermissions,
          dosPermissions: input.dosPermissions,
          createFolders: options.createFolders
        });
        if (!input.dir) {
          zip.file(safeName).unsafeOriginalName = unsafeName;
        }
      }
      if (zipEntries.zipComment.length) {
        zip.comment = zipEntries.zipComment;
      }
      return zip;
    });
  };
});

// node_modules/jszip/lib/index.js
var require_lib = __commonJS((exports, module) => {
  function JSZip() {
    if (!(this instanceof JSZip)) {
      return new JSZip;
    }
    if (arguments.length) {
      throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
    }
    this.files = Object.create(null);
    this.comment = null;
    this.root = "";
    this.clone = function() {
      var newObj = new JSZip;
      for (var i2 in this) {
        if (typeof this[i2] !== "function") {
          newObj[i2] = this[i2];
        }
      }
      return newObj;
    };
  }
  JSZip.prototype = require_object();
  JSZip.prototype.loadAsync = require_load();
  JSZip.support = require_support();
  JSZip.defaults = require_defaults();
  JSZip.version = "3.10.1";
  JSZip.loadAsync = function(content, options) {
    return new JSZip().loadAsync(content, options);
  };
  JSZip.external = require_external();
  module.exports = JSZip;
});

// src/shared/export/adapters/YjsDocumentAdapter.ts
class YjsDocumentAdapter {
  manager;
  constructor(manager) {
    this.manager = manager;
  }
  getMetadata() {
    const meta = this.manager.getMetadata();
    return {
      title: meta.get("title") || "eXeLearning",
      author: meta.get("author") || "",
      description: meta.get("description") || "",
      language: meta.get("language") || "en",
      license: meta.get("license") || "",
      keywords: meta.get("keywords") || "",
      theme: meta.get("theme") || "base",
      version: meta.get("version") || "4.0",
      created: meta.get("createdAt") || new Date().toISOString(),
      modified: meta.get("modifiedAt") || new Date().toISOString(),
      customStyles: meta.get("customStyles") || undefined
    };
  }
  getNavigation() {
    const navigation = this.manager.getNavigation();
    const pages = [];
    this.flattenNavigation(navigation, pages);
    return pages;
  }
  flattenNavigation(navigation, result) {
    navigation.forEach((pageMap) => {
      const page = this.convertPage(pageMap);
      result.push(page);
      const children = pageMap.get("children");
      if (children && children.length > 0) {
        this.flattenNavigation(children, result);
      }
    });
  }
  convertPage(pageMap) {
    const blocksArray = pageMap.get("blocks");
    const blocks = [];
    if (blocksArray) {
      blocksArray.forEach((blockMap, index) => {
        blocks.push(this.convertBlock(blockMap, index));
      });
    }
    return {
      id: pageMap.get("id") || pageMap.get("pageId") || "",
      title: pageMap.get("title") || pageMap.get("pageName") || "Page",
      parentId: pageMap.get("parentId") || null,
      order: pageMap.get("order") || 0,
      blocks
    };
  }
  convertBlock(blockMap, index) {
    const componentsArray = blockMap.get("components");
    const components = [];
    if (componentsArray) {
      componentsArray.forEach((compMap, compIndex) => {
        components.push(this.convertComponent(compMap, compIndex));
      });
    }
    return {
      id: blockMap.get("id") || `block-${index}`,
      name: blockMap.get("name") || blockMap.get("blockName") || "Block",
      order: blockMap.get("order") || index,
      components
    };
  }
  convertComponent(compMap, index) {
    let content = compMap.get("content") || compMap.get("htmlContent") || compMap.get("htmlView") || "";
    if (content && typeof content === "object" && "toString" in content) {
      content = content.toString();
    }
    const propsMap = compMap.get("properties");
    const properties = propsMap ? propsMap.toJSON() : {};
    return {
      id: compMap.get("id") || `comp-${index}`,
      type: compMap.get("type") || compMap.get("ideviceType") || "FreeTextIdevice",
      order: compMap.get("order") || index,
      content,
      properties
    };
  }
  getUsedIdeviceTypes() {
    const types = new Set;
    const pages = this.getNavigation();
    for (const page of pages) {
      for (const block of page.blocks) {
        for (const comp of block.components) {
          if (comp.type) {
            types.add(comp.type);
          }
        }
      }
    }
    return Array.from(types);
  }
  getAllHtmlContent() {
    const htmlParts = [];
    const pages = this.getNavigation();
    for (const page of pages) {
      for (const block of page.blocks) {
        for (const comp of block.components) {
          if (comp.content) {
            htmlParts.push(comp.content);
          }
        }
      }
    }
    return htmlParts.join(`
`);
  }
}

// src/shared/export/adapters/BrowserResourceProvider.ts
class BrowserResourceProvider {
  fetcher;
  constructor(fetcher) {
    this.fetcher = fetcher;
  }
  async fetchTheme(themeName) {
    const blobMap = await this.fetcher.fetchTheme(themeName);
    return this.convertBlobMapToBufferMap(blobMap);
  }
  async fetchIdeviceResources(ideviceType) {
    const blobMap = await this.fetcher.fetchIdevice(ideviceType);
    return this.convertBlobMapToBufferMap(blobMap);
  }
  async fetchBaseLibraries() {
    const blobMap = await this.fetcher.fetchBaseLibraries();
    return this.convertBlobMapToBufferMap(blobMap);
  }
  async fetchScormFiles() {
    const blobMap = await this.fetcher.fetchScormFiles();
    return this.convertBlobMapToBufferMap(blobMap);
  }
  async fetchLibraryFiles(files) {
    const blobMap = await this.fetcher.fetchLibraryFiles(files);
    return this.convertBlobMapToBufferMap(blobMap);
  }
  async fetchLibraryDirectory(libraryName) {
    const blobMap = await this.fetcher.fetchLibraryDirectory(libraryName);
    return this.convertBlobMapToBufferMap(blobMap);
  }
  async fetchSchemas(format) {
    const blobMap = await this.fetcher.fetchSchemas(format);
    return this.convertBlobMapToBufferMap(blobMap);
  }
  async convertBlobMapToBufferMap(blobMap) {
    const result = new Map;
    const entries = Array.from(blobMap.entries());
    const conversions = entries.map(async ([path, blob]) => {
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return { path, buffer };
    });
    const converted = await Promise.all(conversions);
    for (const { path, buffer } of converted) {
      result.set(path, buffer);
    }
    return result;
  }
}

// src/shared/export/adapters/BrowserAssetProvider.ts
class BrowserAssetProvider {
  assetCache;
  assetManager;
  constructor(assetCache, assetManager = null) {
    this.assetCache = assetCache;
    this.assetManager = assetManager;
  }
  async getAsset(assetPath) {
    try {
      const cached = await this.assetCache.getAssetByPath(assetPath);
      if (cached && cached.blob) {
        const arrayBuffer = await cached.blob.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      return null;
    } catch (error) {
      console.warn(`[BrowserAssetProvider] Failed to get asset: ${assetPath}`, error);
      return null;
    }
  }
  async hasAsset(assetPath) {
    try {
      const cached = await this.assetCache.getAssetByPath(assetPath);
      return cached !== null && cached.blob !== undefined;
    } catch {
      return false;
    }
  }
  async listAssets() {
    try {
      const assets = await this.assetCache.getAllAssets();
      return assets.filter((a) => a.metadata?.originalPath).map((a) => a.metadata.originalPath);
    } catch (error) {
      console.warn("[BrowserAssetProvider] Failed to list assets:", error);
      return [];
    }
  }
  async getAllAssets() {
    const result = new Map;
    try {
      const assets = await this.assetCache.getAllAssets();
      for (const asset of assets) {
        if (asset.metadata?.originalPath && asset.blob) {
          const arrayBuffer = await asset.blob.arrayBuffer();
          result.set(asset.metadata.originalPath, Buffer.from(arrayBuffer));
        }
      }
    } catch (error) {
      console.warn("[BrowserAssetProvider] Failed to get all assets:", error);
    }
    return result;
  }
  async resolveAssetUrl(assetPath) {
    try {
      return await this.assetCache.resolveAssetUrl(assetPath);
    } catch {
      return null;
    }
  }
}

// src/shared/export/providers/JSZipZipProvider.ts
class JSZipZipProvider {
  zip;
  files = new Map;
  constructor() {
    const JSZipClass = typeof window !== "undefined" ? window.JSZip : require_lib();
    if (!JSZipClass) {
      throw new Error("JSZip not available. Ensure jszip.min.js is loaded.");
    }
    this.zip = new JSZipClass;
  }
  addFile(path, content) {
    this.files.set(path, content);
    if (typeof content === "string") {
      this.zip.file(path, content);
    } else {
      this.zip.file(path, content, { binary: true });
    }
  }
  hasFile(path) {
    return this.files.has(path);
  }
  getFile(path) {
    return this.files.get(path);
  }
  getFileCount() {
    return this.files.size;
  }
  reset() {
    this.files.clear();
    const JSZipClass = typeof window !== "undefined" ? window.JSZip : require_lib();
    this.zip = new JSZipClass;
  }
  async generateAsync() {
    const arrayBuffer = await this.zip.generateAsync({
      type: "arraybuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
    return Buffer.from(arrayBuffer);
  }
  async generateAsBlob() {
    return await this.zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    });
  }
  async downloadAs(filename) {
    const blob = await this.generateAsBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// src/shared/export/constants.ts
var EXPORT_FORMAT_INFO = {
  ["html5" /* HTML5 */]: {
    name: "HTML5 Website",
    extension: ".zip",
    suffix: "_web",
    description: "Multi-page HTML5 website"
  },
  ["html5-sp" /* HTML5_SINGLE_PAGE */]: {
    name: "HTML5 Single Page",
    extension: ".zip",
    suffix: "_sp",
    description: "Single-page HTML5 with anchor navigation"
  },
  ["scorm12" /* SCORM_12 */]: {
    name: "SCORM 1.2",
    extension: ".zip",
    suffix: "_scorm12",
    description: "SCORM 1.2 package for LMS"
  },
  ["scorm2004" /* SCORM_2004 */]: {
    name: "SCORM 2004",
    extension: ".zip",
    suffix: "_scorm2004",
    description: "SCORM 2004 package for LMS"
  },
  ["ims" /* IMS */]: {
    name: "IMS Content Package",
    extension: ".zip",
    suffix: "_ims",
    description: "IMS Content Package standard"
  },
  ["epub3" /* EPUB3 */]: {
    name: "EPUB3",
    extension: ".epub",
    suffix: "",
    description: "EPUB3 ebook format"
  },
  ["elpx" /* ELPX */]: {
    name: "eXeLearning Project",
    extension: ".elpx",
    suffix: "",
    description: "Native eXeLearning project format"
  }
};
var IDEVICE_CONFIGS = {
  text: { cssClass: "text", componentType: "json", template: "text.html" },
  FreeTextIdevice: { cssClass: "text", componentType: "json", template: "text.html" },
  TextIdevice: { cssClass: "text", componentType: "json", template: "text.html" },
  form: { cssClass: "form", componentType: "json", template: "form.html" },
  QuizActivity: { cssClass: "form", componentType: "json", template: "form.html" },
  MultipleChoiceIdevice: { cssClass: "form", componentType: "json", template: "form.html" },
  guess: { cssClass: "guess", componentType: "json", template: "guess.html" },
  Guess: { cssClass: "guess", componentType: "json", template: "guess.html" },
  checklist: { cssClass: "checklist", componentType: "json", template: "checklist.html" },
  Checklist: { cssClass: "checklist", componentType: "json", template: "checklist.html" },
  rubric: { cssClass: "rubric", componentType: "json", template: "rubric.html" },
  Rubric: { cssClass: "rubric", componentType: "json", template: "rubric.html" },
  casestudy: { cssClass: "casestudy", componentType: "json", template: "casestudy.html" },
  CaseStudy: { cssClass: "casestudy", componentType: "json", template: "casestudy.html" },
  challenge: { cssClass: "challenge", componentType: "json", template: "challenge.html" },
  Challenge: { cssClass: "challenge", componentType: "json", template: "challenge.html" },
  flipcards: { cssClass: "flipcards", componentType: "json", template: "flipcards.html" },
  FlipCards: { cssClass: "flipcards", componentType: "json", template: "flipcards.html" },
  crossword: { cssClass: "crossword", componentType: "json", template: "crossword.html" },
  Crossword: { cssClass: "crossword", componentType: "json", template: "crossword.html" },
  trivial: { cssClass: "trivial", componentType: "json", template: "trivial.html" },
  Trivial: { cssClass: "trivial", componentType: "json", template: "trivial.html" },
  TrivialPursuit: { cssClass: "trivial", componentType: "json", template: "trivial.html" },
  trueorfalse: { cssClass: "trueorfalse", componentType: "json", template: "trueorfalse.html" },
  TrueOrFalse: { cssClass: "trueorfalse", componentType: "json", template: "trueorfalse.html" },
  discover: { cssClass: "discover", componentType: "json", template: "discover.html" },
  Discover: { cssClass: "discover", componentType: "json", template: "discover.html" },
  example: { cssClass: "example", componentType: "json", template: "example.html" },
  Example: { cssClass: "example", componentType: "json", template: "example.html" },
  identify: { cssClass: "identify", componentType: "json", template: "identify.html" },
  Identify: { cssClass: "identify", componentType: "json", template: "identify.html" },
  classify: { cssClass: "classify", componentType: "json", template: "classify.html" },
  Classify: { cssClass: "classify", componentType: "json", template: "classify.html" },
  relate: { cssClass: "relate", componentType: "json", template: "relate.html" },
  Relate: { cssClass: "relate", componentType: "json", template: "relate.html" },
  sort: { cssClass: "sort", componentType: "json", template: "sort.html" },
  Sort: { cssClass: "sort", componentType: "json", template: "sort.html" },
  complete: { cssClass: "complete", componentType: "json", template: "complete.html" },
  Complete: { cssClass: "complete", componentType: "json", template: "complete.html" },
  dragdrop: { cssClass: "dragdrop", componentType: "json", template: "dragdrop.html" },
  DragDrop: { cssClass: "dragdrop", componentType: "json", template: "dragdrop.html" },
  "image-gallery": { cssClass: "image-gallery", componentType: "json", template: "image-gallery.html" },
  ImageGallery: { cssClass: "image-gallery", componentType: "json", template: "image-gallery.html" },
  "interactive-video": {
    cssClass: "interactive-video",
    componentType: "json",
    template: "interactive-video.html"
  },
  InteractiveVideo: {
    cssClass: "interactive-video",
    componentType: "json",
    template: "interactive-video.html"
  },
  "select-media-files": {
    cssClass: "select-media-files",
    componentType: "json",
    template: "select-media-files.html"
  },
  SelectMediaFiles: {
    cssClass: "select-media-files",
    componentType: "json",
    template: "select-media-files.html"
  },
  "az-quiz-game": { cssClass: "az-quiz-game", componentType: "json", template: "az-quiz-game.html" },
  AzQuizGame: { cssClass: "az-quiz-game", componentType: "json", template: "az-quiz-game.html" },
  "word-search": { cssClass: "word-search", componentType: "json", template: "word-search.html" },
  WordSearch: { cssClass: "word-search", componentType: "json", template: "word-search.html" },
  puzzle: { cssClass: "puzzle", componentType: "json", template: "puzzle.html" },
  Puzzle: { cssClass: "puzzle", componentType: "json", template: "puzzle.html" },
  padlock: { cssClass: "padlock", componentType: "json", template: "padlock.html" },
  Padlock: { cssClass: "padlock", componentType: "json", template: "padlock.html" },
  "hidden-image": { cssClass: "hidden-image", componentType: "json", template: "hidden-image.html" },
  HiddenImage: { cssClass: "hidden-image", componentType: "json", template: "hidden-image.html" },
  beforeafter: { cssClass: "beforeafter", componentType: "json", template: "beforeafter.html" },
  BeforeAfter: { cssClass: "beforeafter", componentType: "json", template: "beforeafter.html" },
  "scrambled-list": { cssClass: "scrambled-list", componentType: "json", template: "scrambled-list.html" },
  ScrambledList: { cssClass: "scrambled-list", componentType: "json", template: "scrambled-list.html" },
  mathematicaloperations: {
    cssClass: "mathematicaloperations",
    componentType: "json",
    template: "mathematicaloperations.html"
  },
  MathematicalOperations: {
    cssClass: "mathematicaloperations",
    componentType: "json",
    template: "mathematicaloperations.html"
  },
  mathproblems: { cssClass: "mathproblems", componentType: "json", template: "mathproblems.html" },
  MathProblems: { cssClass: "mathproblems", componentType: "json", template: "mathproblems.html" },
  "periodic-table": { cssClass: "periodic-table", componentType: "json", template: "periodic-table.html" },
  PeriodicTable: { cssClass: "periodic-table", componentType: "json", template: "periodic-table.html" },
  "external-website": {
    cssClass: "external-website",
    componentType: "json",
    template: "external-website.html"
  },
  ExternalWebsite: {
    cssClass: "external-website",
    componentType: "json",
    template: "external-website.html"
  },
  "geogebra-activity": {
    cssClass: "geogebra-activity",
    componentType: "json",
    template: "geogebra-activity.html"
  },
  GeogebraActivity: {
    cssClass: "geogebra-activity",
    componentType: "json",
    template: "geogebra-activity.html"
  },
  map: { cssClass: "map", componentType: "json", template: "map.html" },
  Map: { cssClass: "map", componentType: "json", template: "map.html" },
  "attached-files": { cssClass: "attached-files", componentType: "json", template: "attached-files.html" },
  AttachedFiles: { cssClass: "attached-files", componentType: "json", template: "attached-files.html" },
  "download-source-file": {
    cssClass: "download-source-file",
    componentType: "json",
    template: "download-source-file.html"
  },
  DownloadSourceFile: {
    cssClass: "download-source-file",
    componentType: "json",
    template: "download-source-file.html"
  },
  "progress-report": { cssClass: "progress-report", componentType: "json", template: "progress-report.html" },
  ProgressReport: { cssClass: "progress-report", componentType: "json", template: "progress-report.html" },
  "udl-content": { cssClass: "udl-content", componentType: "json", template: "udl-content.html" },
  UdlContent: { cssClass: "udl-content", componentType: "json", template: "udl-content.html" },
  UDLContent: { cssClass: "udl-content", componentType: "json", template: "udl-content.html" },
  "quick-questions": { cssClass: "quick-questions", componentType: "json", template: "quick-questions.html" },
  QuickQuestions: { cssClass: "quick-questions", componentType: "json", template: "quick-questions.html" },
  "quick-questions-multiple-choice": {
    cssClass: "quick-questions-multiple-choice",
    componentType: "json",
    template: "quick-questions-multiple-choice.html"
  },
  QuickQuestionsMultipleChoice: {
    cssClass: "quick-questions-multiple-choice",
    componentType: "json",
    template: "quick-questions-multiple-choice.html"
  },
  "quick-questions-video": {
    cssClass: "quick-questions-video",
    componentType: "json",
    template: "quick-questions-video.html"
  },
  QuickQuestionsVideo: {
    cssClass: "quick-questions-video",
    componentType: "json",
    template: "quick-questions-video.html"
  },
  magnifier: { cssClass: "magnifier", componentType: "json", template: "magnifier.html" },
  Magnifier: { cssClass: "magnifier", componentType: "json", template: "magnifier.html" },
  ImageMagnifierIdevice: { cssClass: "magnifier", componentType: "json", template: "magnifier.html" },
  "collaborative-editing": {
    cssClass: "collaborative-editing",
    componentType: "json",
    template: "collaborative-editing.html"
  },
  CollaborativeEditing: {
    cssClass: "collaborative-editing",
    componentType: "json",
    template: "collaborative-editing.html"
  }
};
function getIdeviceConfig(ideviceType) {
  if (IDEVICE_CONFIGS[ideviceType]) {
    return IDEVICE_CONFIGS[ideviceType];
  }
  const typeName = ideviceType.toLowerCase().replace("idevice", "");
  return {
    cssClass: typeName,
    componentType: "json",
    template: `${typeName}.html`
  };
}
var LIBRARY_PATTERNS = [
  {
    name: "exe_effects",
    type: "class",
    pattern: "exe-fx",
    files: ["exe_effects/exe_effects.js", "exe_effects/exe_effects.css"]
  },
  {
    name: "exe_games",
    type: "class",
    pattern: "exe-game",
    files: ["exe_games/exe_games.js", "exe_games/exe_games.css"]
  },
  {
    name: "exe_highlighter",
    type: "class",
    pattern: "highlighted-code",
    files: ["exe_highlighter/exe_highlighter.js", "exe_highlighter/exe_highlighter.css"]
  },
  {
    name: "exe_lightbox",
    type: "rel",
    pattern: "lightbox",
    files: ["exe_lightbox/exe_lightbox.js", "exe_lightbox/exe_lightbox.css"]
  },
  {
    name: "exe_lightbox_gallery",
    type: "class",
    pattern: "imageGallery",
    files: ["exe_lightbox/exe_lightbox.js", "exe_lightbox/exe_lightbox.css"]
  },
  {
    name: "exe_tooltips",
    type: "class",
    pattern: "exe-tooltip",
    files: [
      "exe_tooltips/exe_tooltips.js",
      "exe_tooltips/jquery.qtip.min.js",
      "exe_tooltips/jquery.qtip.min.css",
      "exe_tooltips/imagesloaded.pkg.min.js"
    ]
  },
  {
    name: "exe_magnify",
    type: "class",
    pattern: "ImageMagnifierIdevice",
    files: ["exe_magnify/mojomagnify.js"]
  },
  {
    name: "exe_wikipedia",
    type: "class",
    pattern: "exe-wikipedia-content",
    files: ["exe_wikipedia/exe_wikipedia.css"]
  },
  {
    name: "exe_media",
    type: "class",
    pattern: "mediaelement",
    files: [
      "exe_media/exe_media.js",
      "exe_media/exe_media.css",
      "exe_media/exe_media_background.png",
      "exe_media/exe_media_bigplay.png",
      "exe_media/exe_media_bigplay.svg",
      "exe_media/exe_media_controls.png",
      "exe_media/exe_media_controls.svg",
      "exe_media/exe_media_loading.gif"
    ]
  },
  {
    name: "exe_media_link",
    type: "regex",
    pattern: /href="[^"]*\.(mp3|mp4|flv|ogg|ogv)"[^>]*rel="[^"]*lightbox/i,
    files: [
      "exe_media/exe_media.js",
      "exe_media/exe_media.css",
      "exe_media/exe_media_background.png",
      "exe_media/exe_media_bigplay.png",
      "exe_media/exe_media_bigplay.svg",
      "exe_media/exe_media_controls.png",
      "exe_media/exe_media_controls.svg",
      "exe_media/exe_media_loading.gif"
    ]
  },
  {
    name: "abcjs",
    type: "class",
    pattern: "abc-music",
    files: ["abcjs/abcjs-basic-min.js", "abcjs/exe_abc_music.js", "abcjs/abcjs-audio.css"]
  },
  {
    name: "exe_math",
    type: "regex",
    pattern: /\\\(|\\\[/,
    files: ["exe_math/tex-mml-svg.js"]
  },
  {
    name: "exe_math_datagame",
    type: "class",
    pattern: "DataGame",
    files: ["exe_math/tex-mml-svg.js"],
    requiresLatexCheck: true
  },
  {
    name: "mermaid",
    type: "class",
    pattern: "mermaid",
    files: ["mermaid/mermaid.min.js"]
  },
  {
    name: "jquery_ui_ordena",
    type: "class",
    pattern: "ordena-IDevice",
    files: ["jquery-ui/jquery-ui.min.js"]
  },
  {
    name: "jquery_ui_clasifica",
    type: "class",
    pattern: "clasifica-IDevice",
    files: ["jquery-ui/jquery-ui.min.js"]
  },
  {
    name: "jquery_ui_relaciona",
    type: "class",
    pattern: "relaciona-IDevice",
    files: ["jquery-ui/jquery-ui.min.js"]
  },
  {
    name: "jquery_ui_dragdrop",
    type: "class",
    pattern: "dragdrop-IDevice",
    files: ["jquery-ui/jquery-ui.min.js"]
  },
  {
    name: "jquery_ui_completa",
    type: "class",
    pattern: "completa-IDevice",
    files: ["jquery-ui/jquery-ui.min.js"]
  },
  {
    name: "exe_atools",
    type: "class",
    pattern: "exe-atools",
    files: ["exe_atools/exe_atools.js", "exe_atools/exe_atools.css"]
  }
];
var BASE_LIBRARIES = [
  "jquery/jquery.min.js",
  "common_i18n.js",
  "common.js",
  "exe_export.js",
  "bootstrap/bootstrap.bundle.min.js",
  "bootstrap/bootstrap.bundle.min.js.map",
  "bootstrap/bootstrap.min.css",
  "bootstrap/bootstrap.min.css.map"
];
var SCORM_LIBRARIES = ["scorm/SCORM_API_wrapper.js", "scorm/SCOFunctions.js"];
var SCORM_12_NAMESPACES = {
  imscp: "http://www.imsproject.org/xsd/imscp_rootv1p1p2",
  adlcp: "http://www.adlnet.org/xsd/adlcp_rootv1p2",
  imsmd: "http://www.imsglobal.org/xsd/imsmd_v1p2",
  xsi: "http://www.w3.org/2001/XMLSchema-instance"
};
var SCORM_2004_NAMESPACES = {
  imscp: "http://www.imsglobal.org/xsd/imscp_v1p1",
  adlcp: "http://www.adlnet.org/xsd/adlcp_v1p3",
  adlseq: "http://www.adlnet.org/xsd/adlseq_v1p3",
  adlnav: "http://www.adlnet.org/xsd/adlnav_v1p3",
  imsss: "http://www.imsglobal.org/xsd/imsss",
  xsi: "http://www.w3.org/2001/XMLSchema-instance"
};
var IMS_NAMESPACES = {
  imscp: "http://www.imsglobal.org/xsd/imscp_v1p1",
  imsmd: "http://www.imsglobal.org/xsd/imsmd_v1p2",
  xsi: "http://www.w3.org/2001/XMLSchema-instance"
};
var LOM_NAMESPACES = {
  lom: "http://ltsc.ieee.org/xsd/LOM",
  xsi: "http://www.w3.org/2001/XMLSchema-instance"
};

// src/shared/export/renderers/IdeviceRenderer.ts
class IdeviceRenderer {
  render(component, options = { basePath: "", includeDataAttributes: true }) {
    const { basePath = "", includeDataAttributes = true } = options;
    const type = component.type || "text";
    const config = getIdeviceConfig(type);
    const ideviceId = component.id;
    const htmlContent = component.content || "";
    const properties = component.properties || {};
    const classes = ["idevice_node", config.cssClass];
    if (!htmlContent) {
      classes.push("db-no-data");
    }
    if (properties.visibility === "false") {
      classes.push("novisible");
    }
    if (properties.teacherOnly === "true" || properties.visibilityType === "teacher") {
      classes.push("teacher-only");
    }
    if (properties.cssClass && typeof properties.cssClass === "string") {
      classes.push(properties.cssClass);
    }
    let dataAttrs = "";
    if (includeDataAttributes) {
      const isPreviewPath = basePath.includes("/files/perm/idevices/base/");
      const idevicePath = isPreviewPath ? `${basePath}${type}/export/` : `${basePath}idevices/${type}/`;
      dataAttrs = ` data-idevice-path="${this.escapeAttr(idevicePath)}"`;
      dataAttrs += ` data-idevice-type="${this.escapeAttr(type)}"`;
      if (config.componentType === "json") {
        dataAttrs += ` data-idevice-component-type="json"`;
        if (type !== "text" && Object.keys(properties).length > 0) {
          const jsonData = JSON.stringify(properties);
          dataAttrs += ` data-idevice-json-data="${this.escapeAttr(jsonData)}"`;
          dataAttrs += ` data-idevice-template="${this.escapeAttr(config.template)}"`;
        }
      }
    }
    const fixedContent = this.fixAssetUrls(htmlContent, basePath);
    const isTextIdevice = type === "text" || type === "FreeTextIdevice" || type === "TextIdevice";
    const contentHtml = isTextIdevice && fixedContent ? `<div class="exe-text">${fixedContent}</div>` : fixedContent;
    return `<div id="${this.escapeAttr(ideviceId)}" class="${classes.join(" ")}"${dataAttrs}>
${contentHtml}
</div>`;
  }
  renderBlock(block, options = { basePath: "", includeDataAttributes: true }) {
    const { basePath = "", includeDataAttributes = true } = options;
    const blockId = block.id;
    const blockName = block.name || "";
    const components = block.components || [];
    const properties = block.properties || {};
    const classes = ["box"];
    const hasHeader = blockName && blockName.trim() !== "";
    if (!hasHeader) {
      classes.push("no-header");
    }
    if (properties.minimized === "true") {
      classes.push("minimized");
    }
    if (properties.visibility === "false") {
      classes.push("novisible");
    }
    if (properties.teacherOnly === "true" || properties.visibilityType === "teacher") {
      classes.push("teacher-only");
    }
    if (properties.cssClass) {
      classes.push(properties.cssClass);
    }
    let headerHtml = "";
    if (hasHeader) {
      headerHtml = `<header class="box-head no-icon">
<h1 class="box-title">${this.escapeHtml(blockName)}</h1>
</header>`;
    } else {
      headerHtml = '<div class="box-head"></div>';
    }
    let contentHtml = "";
    for (const component of components) {
      contentHtml += this.render(component, { basePath, includeDataAttributes });
    }
    return `<article id="${this.escapeAttr(blockId)}" class="${classes.join(" ")}">
${headerHtml}
<div class="box-content">
${contentHtml}
</div>
</article>`;
  }
  fixAssetUrls(content, basePath) {
    if (!content)
      return "";
    let result = content.replace(/asset:\/\/([^"']+)/g, (_match, assetPath) => {
      return `${basePath}content/resources/${assetPath}`;
    });
    result = result.replace(/files\/tmp\/[^"'\s]+\/([^/]+\/[^"'\s]+)/g, (_match, relativePath) => {
      return `${basePath}content/resources/${relativePath}`;
    });
    result = result.replace(/["']\/files\/tmp\/[^"']+\/([^"']+)["']/g, (_match, path) => {
      return `"${basePath}content/resources/${path}"`;
    });
    return result;
  }
  escapeHtml(str) {
    if (!str)
      return "";
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return String(str).replace(/[&<>"']/g, (m) => map[m]);
  }
  escapeAttr(str) {
    if (!str)
      return "";
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  getCssLinks(ideviceTypes, basePath = "") {
    const links = [];
    const seen = new Set;
    for (const type of ideviceTypes) {
      const config = getIdeviceConfig(type);
      const typeName = type.toLowerCase().replace("idevice", "") || config.cssClass;
      if (!seen.has(typeName)) {
        seen.add(typeName);
        links.push(`<link rel="stylesheet" href="${basePath}idevices/${typeName}/${typeName}.css">`);
      }
    }
    return links;
  }
  getJsScripts(ideviceTypes, basePath = "") {
    const scripts = [];
    const seen = new Set;
    for (const type of ideviceTypes) {
      const config = getIdeviceConfig(type);
      const typeName = type.toLowerCase().replace("idevice", "") || config.cssClass;
      if (!seen.has(typeName)) {
        seen.add(typeName);
        scripts.push(`<script src="${basePath}idevices/${typeName}/${typeName}.js"></script>`);
      }
    }
    return scripts;
  }
  getCssLinkInfo(ideviceTypes, basePath = "") {
    const links = [];
    const seen = new Set;
    for (const type of ideviceTypes) {
      const config = getIdeviceConfig(type);
      const typeName = type.toLowerCase().replace("idevice", "") || config.cssClass;
      if (!seen.has(typeName)) {
        seen.add(typeName);
        const href = `${basePath}idevices/${typeName}/${typeName}.css`;
        links.push({
          href,
          tag: `<link rel="stylesheet" href="${href}">`
        });
      }
    }
    return links;
  }
  getJsScriptInfo(ideviceTypes, basePath = "") {
    const scripts = [];
    const seen = new Set;
    for (const type of ideviceTypes) {
      const config = getIdeviceConfig(type);
      const typeName = type.toLowerCase().replace("idevice", "") || config.cssClass;
      if (!seen.has(typeName)) {
        seen.add(typeName);
        const src = `${basePath}idevices/${typeName}/${typeName}.js`;
        scripts.push({
          src,
          tag: `<script src="${src}"></script>`
        });
      }
    }
    return scripts;
  }
}

// src/shared/export/renderers/PageRenderer.ts
class PageRenderer {
  ideviceRenderer;
  constructor(ideviceRenderer = null) {
    this.ideviceRenderer = ideviceRenderer || new IdeviceRenderer;
  }
  render(page, options) {
    const {
      projectTitle = "eXeLearning",
      language = "en",
      customStyles = "",
      allPages = [],
      basePath = "",
      isIndex = false,
      usedIdevices = [],
      author = "",
      license = "CC-BY-SA",
      isScorm = false,
      scormVersion = "",
      bodyClass = "",
      extraHeadScripts = "",
      onLoadScript = "",
      onUnloadScript = ""
    } = options;
    const pageTitle = page.title || "Page";
    const fullTitle = `${this.escapeHtml(pageTitle)} | ${this.escapeHtml(projectTitle)}`;
    const bodyClassStr = bodyClass || "exe-export exe-web-site";
    const onLoadAttr = onLoadScript ? ` onload="${onLoadScript}"` : "";
    const onUnloadAttr = onUnloadScript ? ` onunload="${onUnloadScript}" onbeforeunload="${onUnloadScript}"` : "";
    return `<!DOCTYPE html>
<html lang="${language}" id="exe-${isIndex ? "index" : page.id}">
<head>
${this.renderHead({ pageTitle: fullTitle, basePath, usedIdevices, customStyles, extraHeadScripts, isScorm, scormVersion })}
</head>
<body class="${bodyClassStr}" lang="${language}"${onLoadAttr}${onUnloadAttr}>
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js siteNav-hidden">
${this.renderNavigation(allPages, page.id, basePath)}
<main id="${page.id}" class="page">
${this.renderPageHeader(page)}
<div id="page-content-${page.id}" class="page-content">
${this.renderPageContent(page, basePath)}
</div>
${this.renderPagination(page, allPages, basePath)}
</main>
${this.renderFooter({ author, license })}
</div>
${this.renderScripts(basePath, isScorm)}
</body>
</html>`;
  }
  renderHead(options) {
    const {
      pageTitle,
      basePath,
      usedIdevices,
      customStyles,
      extraHeadScripts = "",
      isScorm = false
    } = options;
    let head = `<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<script>document.querySelector("html").classList.add("js");</script>
<link rel="stylesheet" href="${basePath}libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="${basePath}content/css/base.css">
<link rel="stylesheet" href="${basePath}theme/content.css">`;
    const cssLinks = this.ideviceRenderer.getCssLinks(usedIdevices, basePath);
    for (const link of cssLinks) {
      head += `
${link}`;
    }
    if (customStyles) {
      head += `
<style>
${customStyles}
</style>`;
    }
    if (extraHeadScripts) {
      head += `
${extraHeadScripts}`;
    }
    return head;
  }
  renderNavigation(allPages, currentPageId, basePath) {
    const rootPages = allPages.filter((p) => !p.parentId);
    let html = `<nav id="siteNav">
<ul>
`;
    for (const page of rootPages) {
      html += this.renderNavItem(page, allPages, currentPageId, basePath);
    }
    html += `</ul>
</nav>`;
    return html;
  }
  renderNavItem(page, allPages, currentPageId, basePath) {
    const children = allPages.filter((p) => p.parentId === page.id);
    const isCurrent = page.id === currentPageId;
    const hasChildren = children.length > 0;
    const isAncestor = this.isAncestorOf(page.id, currentPageId, allPages);
    const classAttr = isCurrent ? ' class="active"' : isAncestor ? ' class="parent"' : "";
    const link = this.getPageLink(page, allPages, basePath);
    const linkClass = hasChildren ? "daddy" : "no-ch";
    let html = `<li${classAttr}>`;
    html += ` <a href="${link}" class="${isCurrent ? "active " : ""}${linkClass}">${this.escapeHtml(page.title)}</a>
`;
    if (hasChildren) {
      html += `<ul class="other-section">
`;
      for (const child of children) {
        html += this.renderNavItem(child, allPages, currentPageId, basePath);
      }
      html += `</ul>
`;
    }
    html += `</li>
`;
    return html;
  }
  isAncestorOf(ancestorId, childId, allPages) {
    const child = allPages.find((p) => p.id === childId);
    if (!child || !child.parentId)
      return false;
    if (child.parentId === ancestorId)
      return true;
    return this.isAncestorOf(ancestorId, child.parentId, allPages);
  }
  getPageLink(page, allPages, basePath) {
    const isFirstPage = page.id === allPages[0]?.id;
    if (isFirstPage) {
      return basePath ? `${basePath}index.html` : "index.html";
    }
    const filename = this.sanitizeFilename(page.title);
    return `${basePath}html/${filename}.html`;
  }
  sanitizeFilename(title) {
    if (!title)
      return "page";
    return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
  }
  renderPageHeader(page) {
    return `<header class="page-header">
<h2 class="page-title">${this.escapeHtml(page.title)}</h2>
</header>`;
  }
  renderPageContent(page, basePath) {
    let html = "";
    for (const block of page.blocks || []) {
      html += this.ideviceRenderer.renderBlock(block, {
        basePath,
        includeDataAttributes: true
      });
    }
    return html;
  }
  renderPagination(page, allPages, basePath) {
    const currentIndex = allPages.findIndex((p) => p.id === page.id);
    const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
    const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
    if (!prevPage && !nextPage) {
      return "";
    }
    let html = `<nav class="pagination">
`;
    if (prevPage) {
      const link = this.getPageLink(prevPage, allPages, basePath);
      html += `<a href="${link}" class="prev"><span>&laquo; </span>${this.escapeHtml(prevPage.title)}</a>`;
    }
    if (prevPage && nextPage) {
      html += " | ";
    }
    if (nextPage) {
      const link = this.getPageLink(nextPage, allPages, basePath);
      html += `<a href="${link}" class="next">${this.escapeHtml(nextPage.title)}<span> &raquo;</span></a>`;
    }
    html += `
</nav>`;
    return html;
  }
  renderFooter(options) {
    const { author, license } = options;
    let html = `<footer id="packageLicense" class="cc cc-by-sa">`;
    if (author) {
      html += `
<p><span>Author:</span> ${this.escapeHtml(author)}</p>`;
    }
    html += `
<p><span>License:</span> ${this.escapeHtml(license)}</p>`;
    html += `
</footer>`;
    return html;
  }
  renderScripts(basePath, isScorm = false) {
    return `<script type="text/javascript" src="${basePath}libs/jquery/jquery.min.js"></script>
<script type="text/javascript" src="${basePath}libs/exe_export.js"></script>
<script type="text/javascript" src="${basePath}libs/common_i18n.js"></script>
<script type="text/javascript" src="${basePath}libs/common.js"></script>
<script type="text/javascript" src="${basePath}theme/default.js"></script>`;
  }
  renderSinglePage(allPages, options = {}) {
    const {
      projectTitle = "eXeLearning",
      language = "en",
      customStyles = "",
      usedIdevices = [],
      author = "",
      license = "CC-BY-SA"
    } = options;
    let contentHtml = "";
    for (const page of allPages) {
      contentHtml += `<section id="section-${page.id}" class="single-page-section">
${this.renderPageHeader(page)}
<div class="page-content">
${this.renderPageContent(page, "")}
</div>
</section>
`;
    }
    return `<!DOCTYPE html>
<html lang="${language}">
<head>
<meta charset="utf-8">
<meta name="generator" content="eXeLearning 4.0 - exelearning.net">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${this.escapeHtml(projectTitle)}</title>
<script>document.querySelector("html").classList.add("js");</script>
<link rel="stylesheet" href="libs/bootstrap/bootstrap.min.css">
<link rel="stylesheet" href="content/css/base.css">
<link rel="stylesheet" href="theme/content.css">
${this.ideviceRenderer.getCssLinks(usedIdevices, "").join(`
`)}
${customStyles ? `<style>
${customStyles}
</style>` : ""}
</head>
<body class="exe-export exe-single-page" lang="${language}">
<script>document.body.className+=" js"</script>
<div class="exe-content exe-export pre-js">
${this.renderSinglePageNav(allPages)}
<main class="single-page-content">
${contentHtml}
</main>
${this.renderFooter({ author, license })}
</div>
${this.renderScripts("")}
</body>
</html>`;
  }
  renderSinglePageNav(allPages) {
    const rootPages = allPages.filter((p) => !p.parentId);
    let html = `<nav id="siteNav" class="single-page-nav">
<ul>
`;
    for (const page of rootPages) {
      html += this.renderSinglePageNavItem(page, allPages);
    }
    html += `</ul>
</nav>`;
    return html;
  }
  renderSinglePageNavItem(page, allPages) {
    const children = allPages.filter((p) => p.parentId === page.id);
    const hasChildren = children.length > 0;
    let html = "<li>";
    html += ` <a href="#section-${page.id}" class="${hasChildren ? "daddy" : "no-ch"}">${this.escapeHtml(page.title)}</a>
`;
    if (hasChildren) {
      html += `<ul class="other-section">
`;
      for (const child of children) {
        html += this.renderSinglePageNavItem(child, allPages);
      }
      html += `</ul>
`;
    }
    html += `</li>
`;
    return html;
  }
  escapeHtml(str) {
    if (!str)
      return "";
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return String(str).replace(/[&<>"']/g, (m) => map[m]);
  }
}

// src/shared/export/utils/LibraryDetector.ts
class LibraryDetector {
  detectedLibraries;
  filesToInclude;
  constructor() {
    this.detectedLibraries = new Set;
    this.filesToInclude = new Set;
  }
  detectLibraries(html, options = {}) {
    this.detectedLibraries.clear();
    this.filesToInclude.clear();
    if (!html || typeof html !== "string") {
      return this._buildResult();
    }
    for (const lib of LIBRARY_PATTERNS) {
      if (this._matchesPattern(html, lib)) {
        if (lib.requiresLatexCheck) {
          if (!this._hasLatexInDataGame(html)) {
            continue;
          }
        }
        this._addLibrary(lib);
      }
    }
    if (options.includeAccessibilityToolbar) {
      const atoolsLib = LIBRARY_PATTERNS.find((l) => l.name === "exe_atools");
      if (atoolsLib) {
        this._addLibrary(atoolsLib);
      }
    }
    return this._buildResult();
  }
  _matchesPattern(html, lib) {
    switch (lib.type) {
      case "class":
        return new RegExp(`class="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, "i").test(html);
      case "rel":
        return new RegExp(`rel="[^"]*${this._escapeRegex(lib.pattern)}[^"]*"`, "i").test(html);
      case "regex":
        return lib.pattern.test(html);
      default:
        return false;
    }
  }
  _hasLatexInDataGame(html) {
    const match = html.match(/<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>(.*?)<\/div>/s);
    if (!match)
      return false;
    const decrypted = this._decrypt(match[1]);
    return /\\\(|\\\[/.test(decrypted);
  }
  _decrypt(str) {
    if (!str || str === "undefined" || str === "null")
      return "";
    try {
      str = decodeURIComponent(str);
      const key = 146;
      let result = "";
      for (let i2 = 0;i2 < str.length; i2++) {
        result += String.fromCharCode(key ^ str.charCodeAt(i2));
      }
      return result;
    } catch {
      return "";
    }
  }
  _addLibrary(lib) {
    if (this.detectedLibraries.has(lib.name))
      return;
    this.detectedLibraries.add(lib.name);
    for (const file of lib.files) {
      this.filesToInclude.add(file);
    }
  }
  _buildResult() {
    const libraries = [];
    for (const lib of LIBRARY_PATTERNS) {
      if (this.detectedLibraries.has(lib.name)) {
        libraries.push({
          name: lib.name,
          files: lib.files
        });
      }
    }
    return {
      libraries,
      files: Array.from(this.filesToInclude),
      count: libraries.length
    };
  }
  getBaseLibraries() {
    return [...BASE_LIBRARIES];
  }
  getScormLibraries() {
    return [...SCORM_LIBRARIES];
  }
  getAllRequiredFiles(html, options = {}) {
    const detected = this.detectLibraries(html, options);
    const files = new Set(this.getBaseLibraries());
    for (const file of detected.files) {
      files.add(file);
    }
    if (options.includeScorm) {
      for (const file of this.getScormLibraries()) {
        files.add(file);
      }
    }
    return Array.from(files);
  }
  groupFilesByType(files) {
    const js = [];
    const css = [];
    for (const file of files) {
      const ext = file.split(".").pop()?.toLowerCase();
      if (ext === "js") {
        js.push(file);
      } else if (ext === "css") {
        css.push(file);
      }
    }
    return { js, css };
  }
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

// src/shared/export/exporters/BaseExporter.ts
class BaseExporter {
  document;
  resources;
  assets;
  zip;
  ideviceRenderer;
  pageRenderer;
  libraryDetector;
  assetFilenameMap = null;
  constructor(document2, resources, assets, zip) {
    this.document = document2;
    this.resources = resources;
    this.assets = assets;
    this.zip = zip;
    this.ideviceRenderer = new IdeviceRenderer;
    this.pageRenderer = new PageRenderer(this.ideviceRenderer);
    this.libraryDetector = new LibraryDetector;
  }
  getMetadata() {
    return this.document.getMetadata();
  }
  getNavigation() {
    return this.document.getNavigation();
  }
  buildPageList() {
    return this.getNavigation();
  }
  getUsedIdevices(pages) {
    const types = new Set;
    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.type) {
            types.add(component.type);
          }
        }
      }
    }
    return Array.from(types);
  }
  getUsedIdevicesForPage(page) {
    const types = new Set;
    for (const block of page.blocks || []) {
      for (const component of block.components || []) {
        if (component.type) {
          types.add(component.type);
        }
      }
    }
    return Array.from(types);
  }
  getRootPages(pages) {
    return pages.filter((p) => !p.parentId);
  }
  getChildPages(parentId, pages) {
    return pages.filter((p) => p.parentId === parentId);
  }
  escapeXml(str) {
    if (!str)
      return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  escapeHtml(str) {
    if (!str)
      return "";
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return String(str).replace(/[&<>"']/g, (m) => map[m]);
  }
  sanitizeFilename(str, maxLength = 50) {
    if (!str)
      return "export";
    return str.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, maxLength);
  }
  sanitizePageFilename(title) {
    if (!title)
      return "page";
    return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
  }
  generateId(prefix = "") {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }
  buildFilename() {
    const meta = this.getMetadata();
    const title = meta.title || "export";
    const sanitized = this.sanitizeFilename(title);
    return `${sanitized}${this.getFileSuffix()}${this.getFileExtension()}`;
  }
  async addAssetsToZip(prefix = "") {
    let assetsAdded = 0;
    try {
      const assets = await this.assets.getAllAssets();
      for (const asset of assets) {
        const assetId = asset.id;
        const filename = asset.filename || `asset-${assetId}`;
        const zipPath = prefix ? `${prefix}${asset.path || `${assetId}/${filename}`}` : asset.path || `${assetId}/${filename}`;
        this.zip.addFile(zipPath, asset.data);
        assetsAdded++;
      }
    } catch (e) {
      console.warn("[BaseExporter] Failed to add assets to ZIP:", e);
    }
    return assetsAdded;
  }
  async addAssetsToZipWithResourcePath() {
    let assetsAdded = 0;
    try {
      const assets = await this.assets.getAllAssets();
      for (const asset of assets) {
        const assetId = asset.id;
        const filename = asset.filename || `asset-${assetId}`;
        const zipPath = `content/resources/${assetId}/${filename}`;
        this.zip.addFile(zipPath, asset.data);
        assetsAdded++;
      }
    } catch (e) {
      console.warn("[BaseExporter] Failed to add assets to ZIP:", e);
    }
    return assetsAdded;
  }
  isAncestorOf(potentialAncestor, childId, allPages) {
    const child = allPages.find((p) => p.id === childId);
    if (!child || !child.parentId)
      return false;
    if (child.parentId === potentialAncestor.id)
      return true;
    return this.isAncestorOf(potentialAncestor, child.parentId, allPages);
  }
  getPageLink(page, allPages, extension = ".html") {
    if (page.id === allPages[0]?.id) {
      return `index${extension}`;
    }
    return `${page.id}${extension}`;
  }
  getPreviousPage(currentPage, allPages) {
    const currentIndex = allPages.findIndex((p) => p.id === currentPage.id);
    return currentIndex > 0 ? allPages[currentIndex - 1] : null;
  }
  getNextPage(currentPage, allPages) {
    const currentIndex = allPages.findIndex((p) => p.id === currentPage.id);
    return currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;
  }
  getExtensionFromMime(mime) {
    const mimeToExt = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/svg+xml": ".svg",
      "image/bmp": ".bmp",
      "image/tiff": ".tiff",
      "image/x-icon": ".ico",
      "application/pdf": ".pdf",
      "video/mp4": ".mp4",
      "video/webm": ".webm",
      "video/ogg": ".ogv",
      "video/quicktime": ".mov",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
      "audio/wav": ".wav",
      "audio/webm": ".weba",
      "application/zip": ".zip",
      "application/json": ".json",
      "text/plain": ".txt",
      "text/html": ".html",
      "text/css": ".css",
      "application/javascript": ".js",
      "application/octet-stream": ".bin"
    };
    return mimeToExt[mime] || ".bin";
  }
  async buildAssetFilenameMap() {
    if (this.assetFilenameMap) {
      return this.assetFilenameMap;
    }
    this.assetFilenameMap = new Map;
    try {
      const assets = await this.assets.getAllAssets();
      for (const asset of assets) {
        const id = asset.id;
        let filename = asset.filename;
        if (!filename) {
          const ext = this.getExtensionFromMime(asset.mimeType || "application/octet-stream");
          filename = `asset-${id.substring(0, 8)}${ext}`;
        }
        this.assetFilenameMap.set(id, filename);
      }
    } catch (e) {
      console.warn("[BaseExporter] Failed to build asset map:", e);
    }
    return this.assetFilenameMap;
  }
  async addFilenamesToAssetUrls(content) {
    if (!content)
      return "";
    const assetMap = await this.buildAssetFilenameMap();
    if (assetMap.size === 0) {
      return content;
    }
    return content.replace(/asset:\/\/([a-f0-9-]+)(?![\/a-zA-Z0-9._-])/gi, (match, uuid) => {
      const filename = assetMap.get(uuid);
      if (filename) {
        return `asset://${uuid}/${filename}`;
      }
      return match;
    });
  }
  async preprocessPagesForExport(pages) {
    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.htmlContent) {
            component.htmlContent = await this.addFilenamesToAssetUrls(component.htmlContent);
          }
        }
      }
    }
    return pages;
  }
  collectAllHtmlContent(pages) {
    const htmlParts = [];
    for (const page of pages) {
      for (const block of page.blocks || []) {
        for (const component of block.components || []) {
          if (component.htmlContent) {
            htmlParts.push(component.htmlContent);
          }
        }
      }
    }
    return htmlParts.join(`
`);
  }
  generateContentXml() {
    const metadata = this.getMetadata();
    const pages = this.getNavigation();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += `<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
`;
    xml += this.generatePropertiesXml(metadata);
    xml += `<odeNavStructures>
`;
    for (let i2 = 0;i2 < pages.length; i2++) {
      xml += this.generatePageXml(pages[i2], i2);
    }
    xml += `</odeNavStructures>
`;
    xml += "</ode>";
    return xml;
  }
  generatePropertiesXml(metadata) {
    let xml = `<odeProperties>
`;
    const props = {
      pp_title: metadata.title || "Untitled",
      pp_author: metadata.author || "",
      pp_lang: metadata.language || "en",
      pp_description: metadata.description || "",
      pp_license: metadata.license || "",
      pp_theme: metadata.theme || "base"
    };
    for (const [key, value] of Object.entries(props)) {
      xml += `  <${key}>${this.escapeXml(value)}</${key}>
`;
    }
    xml += `</odeProperties>
`;
    return xml;
  }
  generatePageXml(page, index) {
    const pageId = page.id;
    const pageName = page.title || "Page";
    const parentId = page.parentId || "";
    const order = page.order ?? index;
    let xml = `<odeNavStructure odeNavStructureId="${this.escapeXml(pageId)}" `;
    xml += `odePageName="${this.escapeXml(pageName)}" odeNavStructureOrder="${order}" `;
    if (parentId) {
      xml += `parentOdeNavStructureId="${this.escapeXml(parentId)}" `;
    }
    xml += `>
`;
    for (let i2 = 0;i2 < (page.blocks || []).length; i2++) {
      xml += this.generateBlockXml(page.blocks[i2], i2);
    }
    xml += `</odeNavStructure>
`;
    return xml;
  }
  generateBlockXml(block, index) {
    const blockId = block.id;
    const blockName = block.name || "Block";
    const order = block.order ?? index;
    let xml = `  <odePagStructure odePagStructureId="${this.escapeXml(blockId)}" `;
    xml += `blockName="${this.escapeXml(blockName)}" odePagStructureOrder="${order}">
`;
    for (let i2 = 0;i2 < (block.components || []).length; i2++) {
      xml += this.generateComponentXml(block.components[i2], i2);
    }
    xml += `  </odePagStructure>
`;
    return xml;
  }
  generateComponentXml(component, index) {
    const compId = component.id;
    const ideviceType = component.type || "FreeTextIdevice";
    const order = component.order ?? index;
    let xml = `    <odeComponent odeComponentId="${this.escapeXml(compId)}" `;
    xml += `odeIdeviceTypeDirName="${this.escapeXml(ideviceType)}" odeComponentOrder="${order}">
`;
    if (component.htmlContent) {
      xml += `      <htmlView><![CDATA[${component.htmlContent}]]></htmlView>
`;
    }
    if (component.properties && Object.keys(component.properties).length > 0) {
      xml += `      <jsonProperties><![CDATA[${JSON.stringify(component.properties)}]]></jsonProperties>
`;
    }
    xml += `    </odeComponent>
`;
    return xml;
  }
  getBaseCss() {
    return `.exe-content{
  background: #fff;
}
.exe-content .page-title{
  font-size: 1.45em;
}
.exe-content .box{
  margin-top: 20px;
  border: 1px solid #dbdbdb;
}
.exe-content a{
  color: #5a7f0c;
}
.exe-content a:hover,
.exe-content a:focus{
  color: #71a300;
}
.exe-content h2{ font-size: 1.45em; }
.exe-content h3{ font-size: 1.35em; }
.exe-content h4{ font-size: 1.25em; }
.exe-content h5{ font-size: 1.15em; }

/* iDevice styles */
.iDevice_wrapper {
  margin-bottom: 25px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background: #fff;
}
.iDevice_content {
  line-height: 1.8;
}
.iDevice_content img {
  max-width: 100%;
  height: auto;
}

/* Navigation */
#siteNav {
  background: #34495e;
  color: #fff;
  padding: 15px 20px;
  min-width: 220px;
}
#siteNav ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
#siteNav li {
  margin: 5px 0;
}
#siteNav a {
  color: #ecf0f1;
  text-decoration: none;
  display: block;
  padding: 5px 10px;
  border-radius: 4px;
}
#siteNav a:hover {
  background: rgba(255,255,255,0.1);
}
#siteNav .active > a,
#siteNav a.active {
  background: #3498db;
  font-weight: bold;
}
#siteNav ul ul {
  padding-left: 15px;
}

/* Pagination */
.pagination {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e0e0e0;
}
.pagination a {
  color: #3498db;
  text-decoration: none;
}
.pagination a:hover {
  text-decoration: underline;
}

/* Footer */
#packageLicense {
  margin-top: 30px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.9em;
  color: #666;
}

/* Responsive */
@media (min-width: 768px) {
  .exe-content {
    display: flex;
    flex-direction: row;
  }
  #siteNav {
    width: 250px;
    flex-shrink: 0;
  }
  main.page {
    flex: 1;
    padding: 20px 30px;
    max-width: 900px;
  }
}
`;
  }
  getFallbackThemeCss() {
    return `/* Default theme CSS */
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 0;
  line-height: 1.6;
}
`;
  }
  getFallbackThemeJs() {
    return `// Default theme JS
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    // Theme initialization
    console.log('[Theme] Default theme loaded');
  });
})();
`;
  }
}

// src/shared/export/exporters/Html5Exporter.ts
class Html5Exporter extends BaseExporter {
  constructor(document2, resources, assets, zip) {
    super(document2, resources, assets, zip);
  }
  getFileExtension() {
    return ".zip";
  }
  getFileSuffix() {
    return "_web";
  }
  async export(options) {
    const exportFilename = options?.filename || this.buildFilename();
    const html5Options = options;
    try {
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.theme || "base";
      pages = await this.preprocessPagesForExport(pages);
      for (let i2 = 0;i2 < pages.length; i2++) {
        const page = pages[i2];
        const html = this.generatePageHtml(page, pages, meta, i2 === 0);
        const pageFilename = i2 === 0 ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
        this.zip.addFile(pageFilename, html);
      }
      const contentXml = this.generateContentXml();
      this.zip.addFile("content.xml", contentXml);
      this.zip.addFile("content/css/base.css", this.getBaseCss());
      try {
        const themeFiles = await this.resources.fetchTheme(themeName);
        for (const [path, content] of themeFiles) {
          this.zip.addFile(`theme/${path}`, content);
        }
      } catch {
        this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
        this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
      }
      const allHtmlContent = this.collectAllHtmlContent(pages);
      const allRequiredFiles = this.libraryDetector.getAllRequiredFiles(allHtmlContent, {
        includeAccessibilityToolbar: meta.accessibilityToolbar === true
      });
      try {
        const libFiles = await this.resources.fetchLibraryFiles(allRequiredFiles);
        for (const [path, content] of libFiles) {
          this.zip.addFile(`libs/${path}`, content);
        }
      } catch {
        try {
          const baseLibs = await this.resources.fetchBaseLibraries();
          for (const [path, content] of baseLibs) {
            this.zip.addFile(`libs/${path}`, content);
          }
        } catch {}
      }
      const usedIdevices = this.getUsedIdevices(pages);
      for (const idevice of usedIdevices) {
        try {
          const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
          for (const [path, content] of ideviceFiles) {
            this.zip.addFile(`idevices/${idevice}/${path}`, content);
          }
        } catch {}
      }
      await this.addAssetsToZipWithResourcePath();
      const buffer = await this.zip.generateAsync();
      return {
        success: true,
        filename: exportFilename,
        data: buffer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  generatePageHtml(page, allPages, meta, isIndex) {
    const basePath = isIndex ? "" : "../";
    const usedIdevices = this.getUsedIdevicesForPage(page);
    return this.pageRenderer.render(page, {
      projectTitle: meta.title || "eXeLearning",
      language: meta.language || "en",
      theme: meta.theme || "base",
      customStyles: meta.customStyles || "",
      allPages,
      basePath,
      isIndex,
      usedIdevices,
      author: meta.author || "",
      license: meta.license || "CC-BY-SA"
    });
  }
  getPageLinkForHtml5(page, allPages, basePath) {
    const isFirstPage = page.id === allPages[0]?.id;
    if (isFirstPage) {
      return basePath ? `${basePath}index.html` : "index.html";
    }
    const filename = this.sanitizePageFilename(page.title);
    return `${basePath}html/${filename}.html`;
  }
}

// src/shared/export/exporters/PageExporter.ts
class PageExporter extends Html5Exporter {
  constructor(document2, resources, assets, zip) {
    super(document2, resources, assets, zip);
  }
  getFileSuffix() {
    return "_page";
  }
  async export(options) {
    const exportFilename = options?.filename || this.buildFilename();
    try {
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.theme || "base";
      pages = await this.preprocessPagesForExport(pages);
      const usedIdevices = this.getUsedIdevices(pages);
      const html = this.generateSinglePageHtml(pages, meta, usedIdevices);
      this.zip.addFile("index.html", html);
      const contentXml = this.generateContentXml();
      this.zip.addFile("content.xml", contentXml);
      this.zip.addFile("content/css/base.css", this.getBaseCss());
      this.zip.addFile("content/css/single-page.css", this.getSinglePageCss());
      try {
        const themeFiles = await this.resources.fetchTheme(themeName);
        for (const [path, content] of themeFiles) {
          this.zip.addFile(`theme/${path}`, content);
        }
      } catch {
        this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
        this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
      }
      try {
        const baseLibs = await this.resources.fetchBaseLibraries();
        for (const [path, content] of baseLibs) {
          this.zip.addFile(`libs/${path}`, content);
        }
      } catch {}
      for (const idevice of usedIdevices) {
        try {
          const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
          for (const [path, content] of ideviceFiles) {
            this.zip.addFile(`idevices/${idevice}/${path}`, content);
          }
        } catch {}
      }
      await this.addAssetsToZipWithResourcePath();
      const buffer = await this.zip.generateAsync();
      return {
        success: true,
        filename: exportFilename,
        data: buffer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  generateSinglePageHtml(pages, meta, usedIdevices) {
    return this.pageRenderer.renderSinglePage(pages, {
      projectTitle: meta.title || "eXeLearning",
      language: meta.language || "en",
      theme: meta.theme || "base",
      customStyles: meta.customStyles || "",
      usedIdevices,
      author: meta.author || "",
      license: meta.license || "CC-BY-SA"
    });
  }
  getSinglePageCss() {
    return `/* Single-page specific styles */
.exe-single-page .single-page-section {
  border-bottom: 2px solid #e0e0e0;
  padding-bottom: 40px;
  margin-bottom: 40px;
}

.exe-single-page .single-page-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.exe-single-page .single-page-nav {
  position: sticky;
  top: 0;
  max-height: 100vh;
  overflow-y: auto;
}

.exe-single-page .single-page-content {
  padding: 20px 30px;
}

/* Smooth scrolling for anchor links */
html {
  scroll-behavior: smooth;
}

/* Section target offset for fixed header */
.single-page-section:target {
  scroll-margin-top: 20px;
}

/* Print styles for single page */
@media print {
  .exe-single-page .single-page-nav {
    display: none;
  }
  .exe-single-page .single-page-section {
    page-break-inside: avoid;
  }
}
`;
  }
}

// src/shared/export/generators/Scorm12Manifest.ts
class Scorm12ManifestGenerator {
  projectId;
  pages;
  metadata;
  constructor(projectId, pages, metadata = {}) {
    this.projectId = projectId || this.generateId();
    this.pages = pages || [];
    this.metadata = metadata;
  }
  generateId() {
    return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  generate(options = {}) {
    const { commonFiles = [], pageFiles = {} } = options;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += this.generateManifestOpen();
    xml += this.generateMetadata();
    xml += this.generateOrganizations();
    xml += this.generateResources(commonFiles, pageFiles);
    xml += `</manifest>
`;
    return xml;
  }
  generateManifestOpen() {
    return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_12_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_12_NAMESPACES.adlcp}"
  xmlns:imsmd="${SCORM_12_NAMESPACES.imsmd}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCORM_12_NAMESPACES.imscp} imscp_rootv1p1p2.xsd
    ${SCORM_12_NAMESPACES.imsmd} imsmd_v1p2p2.xsd
    ${SCORM_12_NAMESPACES.adlcp} adlcp_rootv1p2.xsd">
`;
  }
  generateMetadata() {
    let xml = `  <metadata>
`;
    xml += `    <schema>ADL SCORM</schema>
`;
    xml += `    <schemaversion>1.2</schemaversion>
`;
    xml += `    <adlcp:location>imslrm.xml</adlcp:location>
`;
    xml += `  </metadata>
`;
    return xml;
  }
  generateOrganizations() {
    const orgId = `eXe-${this.projectId}`;
    const title = this.metadata.title || "eXeLearning";
    let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
    xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
    xml += `      <title>${this.escapeXml(title)}</title>
`;
    xml += this.generateItems();
    xml += `    </organization>
`;
    xml += `  </organizations>
`;
    return xml;
  }
  generateItems() {
    const pageMap = new Map;
    for (const page of this.pages) {
      pageMap.set(page.id, page);
    }
    const rootPages = this.pages.filter((p) => !p.parentId);
    let xml = "";
    for (const page of rootPages) {
      xml += this.generateItemRecursive(page, pageMap, 3);
    }
    return xml;
  }
  generateItemRecursive(page, pageMap, indent) {
    const indentStr = "  ".repeat(indent);
    const isVisible = "true";
    let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
    xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
    const children = this.pages.filter((p) => p.parentId === page.id);
    for (const child of children) {
      xml += this.generateItemRecursive(child, pageMap, indent + 1);
    }
    xml += `${indentStr}</item>
`;
    return xml;
  }
  generateResources(commonFiles, pageFiles) {
    let xml = `  <resources>
`;
    for (const page of this.pages) {
      const pageFile = pageFiles[page.id] || {};
      xml += this.generatePageResource(page, pageFile);
    }
    xml += this.generateCommonFilesResource(commonFiles);
    xml += `  </resources>
`;
    return xml;
  }
  generatePageResource(page, pageFile) {
    const pageId = page.id;
    const isIndex = this.pages.indexOf(page) === 0;
    const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
    let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormtype="sco" href="${this.escapeXml(fileUrl)}">
`;
    xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
    const files = pageFile.files || [];
    for (const file of files) {
      xml += `      <file href="${this.escapeXml(file)}"/>
`;
    }
    xml += `      <dependency identifierref="COMMON_FILES"/>
`;
    xml += `    </resource>
`;
    return xml;
  }
  generateCommonFilesResource(commonFiles) {
    let xml = `    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormtype="asset">
`;
    for (const file of commonFiles) {
      xml += `      <file href="${this.escapeXml(file)}"/>
`;
    }
    xml += `    </resource>
`;
    return xml;
  }
  escapeXml(str) {
    if (!str)
      return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  sanitizeFilename(title) {
    if (!title)
      return "page";
    return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
  }
}

// src/shared/export/generators/LomMetadata.ts
var TRANSLATIONS = {
  "Metadata creation date": {
    en: "Metadata creation date",
    es: "Fecha de creación de los metadatos",
    fr: "Date de création des métadonnées",
    de: "Erstellungsdatum der Metadaten",
    pt: "Data de criação dos metadados",
    ca: "Data de creació de les metadades",
    eu: "Metadatuen sorrera data",
    gl: "Data de creación dos metadatos"
  }
};

class LomMetadataGenerator {
  projectId;
  metadata;
  constructor(projectId, metadata = {}) {
    this.projectId = projectId || this.generateId();
    this.metadata = metadata;
  }
  generateId() {
    return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  generate() {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += this.generateLomOpen();
    xml += this.generateGeneral();
    xml += this.generateLifeCycle();
    xml += this.generateMetaMetadata();
    xml += this.generateTechnical();
    xml += this.generateEducational();
    xml += this.generateRights();
    xml += `</lom>
`;
    return xml;
  }
  generateLomOpen() {
    return `<lom xmlns="${LOM_NAMESPACES.lom}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${LOM_NAMESPACES.lom} lomCustom.xsd">
`;
  }
  generateGeneral() {
    const title = this.metadata.title || "eXe-p-" + this.projectId;
    const lang = this.metadata.language || "en";
    const description = this.metadata.description || "";
    const catalogName = this.metadata.catalogName || "none";
    const catalogEntry = this.metadata.catalogEntry || "ODE-" + this.projectId;
    let xml = `  <general uniqueElementName="general">
`;
    xml += `    <identifier>
`;
    xml += `      <catalog uniqueElementName="catalog">${this.escapeXml(catalogName)}</catalog>
`;
    xml += `      <entry uniqueElementName="entry">${this.escapeXml(catalogEntry)}</entry>
`;
    xml += `    </identifier>
`;
    xml += `    <title>
`;
    xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(title)}</string>
`;
    xml += `    </title>
`;
    xml += `    <language>${this.escapeXml(lang)}</language>
`;
    xml += `    <description>
`;
    xml += `      <string language="${this.escapeXml(lang)}">${this.escapeXml(description)}</string>
`;
    xml += `    </description>
`;
    xml += `    <aggregationLevel uniqueElementName="aggregationLevel">
`;
    xml += `      <source uniqueElementName="source">LOM-ESv1.0</source>
`;
    xml += `      <value uniqueElementName="value">2</value>
`;
    xml += `    </aggregationLevel>
`;
    xml += `  </general>
`;
    return xml;
  }
  generateLifeCycle() {
    const author = this.metadata.author || "";
    const lang = this.metadata.language || "en";
    const dateTime = this.getCurrentDateTime();
    let xml = `  <lifeCycle>
`;
    xml += `    <contribute>
`;
    xml += `      <role uniqueElementName="role">
`;
    xml += `        <source uniqueElementName="source">LOM-ESv1.0</source>
`;
    xml += `        <value uniqueElementName="value">author</value>
`;
    xml += `      </role>
`;
    const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
    xml += `      <entity>${this.escapeXml(vcard)}</entity>
`;
    xml += `      <date>
`;
    xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>
`;
    xml += `        <description>
`;
    xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString("Metadata creation date", lang)}</string>
`;
    xml += `        </description>
`;
    xml += `      </date>
`;
    xml += `    </contribute>
`;
    xml += `  </lifeCycle>
`;
    return xml;
  }
  generateMetaMetadata() {
    const author = this.metadata.author || "";
    const lang = this.metadata.language || "en";
    const dateTime = this.getCurrentDateTime();
    let xml = `  <metaMetadata uniqueElementName="metaMetadata">
`;
    xml += `    <contribute>
`;
    xml += `      <role uniqueElementName="role">
`;
    xml += `        <source uniqueElementName="source">LOM-ESv1.0</source>
`;
    xml += `        <value uniqueElementName="value">creator</value>
`;
    xml += `      </role>
`;
    const vcard = `BEGIN:VCARD VERSION:3.0 FN:${author} EMAIL;TYPE=INTERNET: ORG: END:VCARD`;
    xml += `      <entity>${this.escapeXml(vcard)}</entity>
`;
    xml += `      <date>
`;
    xml += `        <dateTime uniqueElementName="dateTime">${dateTime}</dateTime>
`;
    xml += `        <description>
`;
    xml += `          <string language="${this.escapeXml(lang)}">${this.getLocalizedString("Metadata creation date", lang)}</string>
`;
    xml += `        </description>
`;
    xml += `      </date>
`;
    xml += `    </contribute>
`;
    xml += `    <metadataSchema>LOM-ESv1.0</metadataSchema>
`;
    xml += `    <language>${this.escapeXml(lang)}</language>
`;
    xml += `  </metaMetadata>
`;
    return xml;
  }
  generateTechnical() {
    const lang = this.metadata.language || "en";
    let xml = `  <technical uniqueElementName="technical">
`;
    xml += `    <otherPlatformRequirements>
`;
    xml += `      <string language="${this.escapeXml(lang)}">editor: eXe Learning</string>
`;
    xml += `    </otherPlatformRequirements>
`;
    xml += `  </technical>
`;
    return xml;
  }
  generateEducational() {
    const lang = this.metadata.language || "en";
    let xml = `  <educational>
`;
    xml += `    <language>${this.escapeXml(lang)}</language>
`;
    xml += `  </educational>
`;
    return xml;
  }
  generateRights() {
    const license = this.metadata.license || "";
    let xml = `  <rights uniqueElementName="rights">
`;
    xml += `    <copyrightAndOtherRestrictions uniqueElementName="copyrightAndOtherRestrictions">
`;
    xml += `      <source uniqueElementName="source">LOM-ESv1.0</source>
`;
    xml += `      <value uniqueElementName="value">${this.escapeXml(license)}</value>
`;
    xml += `    </copyrightAndOtherRestrictions>
`;
    xml += `    <access uniqueElementName="access">
`;
    xml += `      <accessType uniqueElementName="accessType">
`;
    xml += `        <source uniqueElementName="source">LOM-ESv1.0</source>
`;
    xml += `        <value uniqueElementName="value">universal</value>
`;
    xml += `      </accessType>
`;
    xml += `      <description>
`;
    xml += `        <string language="en">Default</string>
`;
    xml += `      </description>
`;
    xml += `    </access>
`;
    xml += `  </rights>
`;
    return xml;
  }
  getCurrentDateTime() {
    const now = new Date;
    const offset = now.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(offset / 60)).toString().padStart(2, "0");
    const offsetMinutes = Math.abs(offset % 60).toString().padStart(2, "0");
    const offsetSign = offset <= 0 ? "+" : "-";
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const day = now.getDate().toString().padStart(2, "0");
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const seconds = now.getSeconds().toString().padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.00${offsetSign}${offsetHours}:${offsetMinutes}`;
  }
  getLocalizedString(key, lang) {
    const langShort = lang.substring(0, 2).toLowerCase();
    if (TRANSLATIONS[key] && TRANSLATIONS[key][langShort]) {
      return TRANSLATIONS[key][langShort];
    }
    return TRANSLATIONS[key]?.en || key;
  }
  escapeXml(str) {
    if (!str)
      return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
}

// src/shared/export/exporters/Scorm12Exporter.ts
class Scorm12Exporter extends Html5Exporter {
  manifestGenerator = null;
  lomGenerator = null;
  constructor(document2, resources, assets, zip) {
    super(document2, resources, assets, zip);
  }
  getFileSuffix() {
    return "_scorm12";
  }
  async export(options) {
    const exportFilename = options?.filename || this.buildFilename();
    try {
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.theme || "base";
      const projectId = this.generateProjectId();
      pages = await this.preprocessPagesForExport(pages);
      this.manifestGenerator = new Scorm12ManifestGenerator(projectId, pages, {
        title: meta.title || "eXeLearning",
        language: meta.language || "en",
        author: meta.author || "",
        description: meta.description || "",
        license: meta.license || ""
      });
      this.lomGenerator = new LomMetadataGenerator(projectId, {
        title: meta.title || "eXeLearning",
        language: meta.language || "en",
        author: meta.author || "",
        description: meta.description || "",
        license: meta.license || ""
      });
      const commonFiles = [];
      const pageFiles = {};
      for (let i2 = 0;i2 < pages.length; i2++) {
        const page = pages[i2];
        const isIndex = i2 === 0;
        const html = this.generateScormPageHtml(page, pages, meta, isIndex);
        const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
        this.zip.addFile(pageFilename, html);
        pageFiles[page.id] = {
          fileUrl: pageFilename,
          files: []
        };
      }
      this.zip.addFile("content/css/base.css", this.getBaseCss());
      commonFiles.push("content/css/base.css");
      try {
        const themeFiles = await this.resources.fetchTheme(themeName);
        for (const [path, content] of themeFiles) {
          this.zip.addFile(`theme/${path}`, content);
          commonFiles.push(`theme/${path}`);
        }
      } catch {
        this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
        this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
        commonFiles.push("theme/content.css", "theme/default.js");
      }
      try {
        const baseLibs = await this.resources.fetchBaseLibraries();
        for (const [path, content] of baseLibs) {
          this.zip.addFile(`libs/${path}`, content);
          commonFiles.push(`libs/${path}`);
        }
      } catch {}
      try {
        const scormFiles = await this.resources.fetchScormFiles("1.2");
        for (const [path, content] of scormFiles) {
          this.zip.addFile(`libs/${path}`, content);
          commonFiles.push(`libs/${path}`);
        }
      } catch {
        this.zip.addFile("libs/SCORM_API_wrapper.js", this.getScormApiWrapper());
        this.zip.addFile("libs/SCOFunctions.js", this.getScoFunctions());
        commonFiles.push("libs/SCORM_API_wrapper.js", "libs/SCOFunctions.js");
      }
      const usedIdevices = this.getUsedIdevices(pages);
      for (const idevice of usedIdevices) {
        try {
          const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
          for (const [path, content] of ideviceFiles) {
            this.zip.addFile(`idevices/${idevice}/${path}`, content);
            commonFiles.push(`idevices/${idevice}/${path}`);
          }
        } catch {}
      }
      await this.addAssetsToZipWithResourcePath();
      const manifestXml = this.manifestGenerator.generate({
        commonFiles,
        pageFiles
      });
      this.zip.addFile("imsmanifest.xml", manifestXml);
      const lomXml = this.lomGenerator.generate();
      this.zip.addFile("imslrm.xml", lomXml);
      const buffer = await this.zip.generateAsync();
      return {
        success: true,
        filename: exportFilename,
        data: buffer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  generateProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  generateScormPageHtml(page, allPages, meta, isIndex) {
    const basePath = isIndex ? "" : "../";
    const usedIdevices = this.getUsedIdevicesForPage(page);
    return this.pageRenderer.render(page, {
      projectTitle: meta.title || "eXeLearning",
      language: meta.language || "en",
      theme: meta.theme || "base",
      customStyles: meta.customStyles || "",
      allPages,
      basePath,
      isIndex,
      usedIdevices,
      author: meta.author || "",
      license: meta.license || "CC-BY-SA",
      isScorm: true,
      scormVersion: "1.2",
      bodyClass: "exe-scorm exe-scorm12",
      extraHeadScripts: this.getScormHeadScripts(basePath),
      onLoadScript: "loadPage()",
      onUnloadScript: "unloadPage()"
    });
  }
  getScormHeadScripts(basePath) {
    return `<script src="${basePath}libs/SCORM_API_wrapper.js"></script>
<script src="${basePath}libs/SCOFunctions.js"></script>`;
  }
  getScormApiWrapper() {
    return `/**
 * SCORM API Wrapper
 * Minimal implementation for SCORM 1.2 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "1.2",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.LMSInitialize("");
    if (success) { this.connection.isActive = true; }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSFinish("");
    if (success) { this.connection.isActive = false; }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.LMSGetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSSetValue(parameter, value);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.LMSCommit("");
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
  }
  getScoFunctions() {
    return `/**
 * SCO Functions for SCORM 1.2
 * Page load/unload handlers for SCORM communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.core.lesson_status");
    if (status === "not attempted" || status === "") {
      scorm.set("cmi.core.lesson_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    elapsed = Math.round(elapsed / 1000);
    var hours = Math.floor(elapsed / 3600);
    var mins = Math.floor((elapsed - hours * 3600) / 60);
    var secs = elapsed - hours * 3600 - mins * 60;
    hours = hours < 10 ? "0" + hours : hours;
    mins = mins < 10 ? "0" + mins : mins;
    secs = secs < 10 ? "0" + secs : secs;
    var sessionTime = hours + ":" + mins + ":" + secs;
    scorm.set("cmi.core.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.core.lesson_status", "completed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.core.lesson_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  scorm.set("cmi.core.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.core.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.core.score.min", minScore);
  scorm.save();
}
`;
  }
}

// src/shared/export/generators/Scorm2004Manifest.ts
class Scorm2004ManifestGenerator {
  projectId;
  pages;
  metadata;
  constructor(projectId, pages, metadata = {}) {
    this.projectId = projectId || this.generateId();
    this.pages = pages || [];
    this.metadata = metadata;
  }
  generateId() {
    return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  generate(options = {}) {
    const { commonFiles = [], pageFiles = {} } = options;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += this.generateManifestOpen();
    xml += this.generateMetadata();
    xml += this.generateOrganizations();
    xml += this.generateResources(commonFiles, pageFiles);
    xml += `</manifest>
`;
    return xml;
  }
  generateManifestOpen() {
    return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${SCORM_2004_NAMESPACES.imscp}"
  xmlns:adlcp="${SCORM_2004_NAMESPACES.adlcp}"
  xmlns:adlseq="${SCORM_2004_NAMESPACES.adlseq}"
  xmlns:adlnav="${SCORM_2004_NAMESPACES.adlnav}"
  xmlns:imsss="${SCORM_2004_NAMESPACES.imsss}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${SCORM_2004_NAMESPACES.imscp} imscp_v1p1.xsd
    ${SCORM_2004_NAMESPACES.adlcp} adlcp_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlseq} adlseq_v1p3.xsd
    ${SCORM_2004_NAMESPACES.adlnav} adlnav_v1p3.xsd
    ${SCORM_2004_NAMESPACES.imsss} imsss_v1p0.xsd">
`;
  }
  generateMetadata() {
    let xml = `  <metadata>
`;
    xml += `    <schema>ADL SCORM</schema>
`;
    xml += `    <schemaversion>2004 4th Edition</schemaversion>
`;
    xml += `    <adlcp:location>imslrm.xml</adlcp:location>
`;
    xml += `  </metadata>
`;
    return xml;
  }
  generateOrganizations() {
    const orgId = `eXe-${this.projectId}`;
    const title = this.metadata.title || "eXeLearning";
    let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
    xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
    xml += `      <title>${this.escapeXml(title)}</title>
`;
    xml += this.generateItems();
    xml += this.generateOrganizationSequencing();
    xml += `    </organization>
`;
    xml += `  </organizations>
`;
    return xml;
  }
  generateOrganizationSequencing() {
    return `      <imsss:sequencing>
        <imsss:controlMode choice="true" choiceExit="true" flow="true" forwardOnly="false"/>
      </imsss:sequencing>
`;
  }
  generateItems() {
    const pageMap = new Map;
    for (const page of this.pages) {
      pageMap.set(page.id, page);
    }
    const rootPages = this.pages.filter((p) => !p.parentId);
    let xml = "";
    for (const page of rootPages) {
      xml += this.generateItemRecursive(page, pageMap, 3);
    }
    return xml;
  }
  generateItemRecursive(page, pageMap, indent) {
    const indentStr = "  ".repeat(indent);
    const isVisible = "true";
    const children = this.pages.filter((p) => p.parentId === page.id);
    const hasChildren = children.length > 0;
    let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
    xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
    for (const child of children) {
      xml += this.generateItemRecursive(child, pageMap, indent + 1);
    }
    if (hasChildren) {
      xml += this.generateItemSequencing(indentStr + "  ");
    }
    xml += `${indentStr}</item>
`;
    return xml;
  }
  generateItemSequencing(indentStr) {
    return `${indentStr}<imsss:sequencing>
${indentStr}  <imsss:controlMode choice="true" choiceExit="true" flow="true"/>
${indentStr}</imsss:sequencing>
`;
  }
  generateResources(commonFiles, pageFiles) {
    let xml = `  <resources>
`;
    for (const page of this.pages) {
      const pageFile = pageFiles[page.id] || {};
      xml += this.generatePageResource(page, pageFile);
    }
    xml += this.generateCommonFilesResource(commonFiles);
    xml += `  </resources>
`;
    return xml;
  }
  generatePageResource(page, pageFile) {
    const pageId = page.id;
    const isIndex = this.pages.indexOf(page) === 0;
    const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
    let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" adlcp:scormType="sco" href="${this.escapeXml(fileUrl)}">
`;
    xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
    const files = pageFile.files || [];
    for (const file of files) {
      xml += `      <file href="${this.escapeXml(file)}"/>
`;
    }
    xml += `      <dependency identifierref="COMMON_FILES"/>
`;
    xml += `    </resource>
`;
    return xml;
  }
  generateCommonFilesResource(commonFiles) {
    let xml = `    <resource identifier="COMMON_FILES" type="webcontent" adlcp:scormType="asset">
`;
    for (const file of commonFiles) {
      xml += `      <file href="${this.escapeXml(file)}"/>
`;
    }
    xml += `    </resource>
`;
    return xml;
  }
  escapeXml(str) {
    if (!str)
      return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  sanitizeFilename(title) {
    if (!title)
      return "page";
    return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
  }
}

// src/shared/export/exporters/Scorm2004Exporter.ts
class Scorm2004Exporter extends Html5Exporter {
  manifestGenerator = null;
  lomGenerator = null;
  constructor(document2, resources, assets, zip) {
    super(document2, resources, assets, zip);
  }
  getFileSuffix() {
    return "_scorm2004";
  }
  async export(options) {
    const exportFilename = options?.filename || this.buildFilename();
    try {
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.theme || "base";
      const projectId = this.generateProjectId();
      pages = await this.preprocessPagesForExport(pages);
      this.manifestGenerator = new Scorm2004ManifestGenerator(projectId, pages, {
        title: meta.title || "eXeLearning",
        language: meta.language || "en",
        author: meta.author || "",
        description: meta.description || "",
        license: meta.license || ""
      });
      this.lomGenerator = new LomMetadataGenerator(projectId, {
        title: meta.title || "eXeLearning",
        language: meta.language || "en",
        author: meta.author || "",
        description: meta.description || "",
        license: meta.license || ""
      });
      const commonFiles = [];
      const pageFiles = {};
      for (let i2 = 0;i2 < pages.length; i2++) {
        const page = pages[i2];
        const isIndex = i2 === 0;
        const html = this.generateScorm2004PageHtml(page, pages, meta, isIndex);
        const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
        this.zip.addFile(pageFilename, html);
        pageFiles[page.id] = {
          fileUrl: pageFilename,
          files: []
        };
      }
      this.zip.addFile("content/css/base.css", this.getBaseCss());
      commonFiles.push("content/css/base.css");
      try {
        const themeFiles = await this.resources.fetchTheme(themeName);
        for (const [path, content] of themeFiles) {
          this.zip.addFile(`theme/${path}`, content);
          commonFiles.push(`theme/${path}`);
        }
      } catch {
        this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
        this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
        commonFiles.push("theme/content.css", "theme/default.js");
      }
      try {
        const baseLibs = await this.resources.fetchBaseLibraries();
        for (const [path, content] of baseLibs) {
          this.zip.addFile(`libs/${path}`, content);
          commonFiles.push(`libs/${path}`);
        }
      } catch {}
      try {
        const scormFiles = await this.resources.fetchScormFiles("2004");
        for (const [path, content] of scormFiles) {
          this.zip.addFile(`libs/${path}`, content);
          commonFiles.push(`libs/${path}`);
        }
      } catch {
        this.zip.addFile("libs/SCORM_API_wrapper.js", this.getScorm2004ApiWrapper());
        this.zip.addFile("libs/SCOFunctions.js", this.getSco2004Functions());
        commonFiles.push("libs/SCORM_API_wrapper.js", "libs/SCOFunctions.js");
      }
      const usedIdevices = this.getUsedIdevices(pages);
      for (const idevice of usedIdevices) {
        try {
          const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
          for (const [path, content] of ideviceFiles) {
            this.zip.addFile(`idevices/${idevice}/${path}`, content);
            commonFiles.push(`idevices/${idevice}/${path}`);
          }
        } catch {}
      }
      await this.addAssetsToZipWithResourcePath();
      const manifestXml = this.manifestGenerator.generate({
        commonFiles,
        pageFiles
      });
      this.zip.addFile("imsmanifest.xml", manifestXml);
      const lomXml = this.lomGenerator.generate();
      this.zip.addFile("imslrm.xml", lomXml);
      const buffer = await this.zip.generateAsync();
      return {
        success: true,
        filename: exportFilename,
        data: buffer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  generateProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  generateScorm2004PageHtml(page, allPages, meta, isIndex) {
    const basePath = isIndex ? "" : "../";
    const usedIdevices = this.getUsedIdevicesForPage(page);
    return this.pageRenderer.render(page, {
      projectTitle: meta.title || "eXeLearning",
      language: meta.language || "en",
      theme: meta.theme || "base",
      customStyles: meta.customStyles || "",
      allPages,
      basePath,
      isIndex,
      usedIdevices,
      author: meta.author || "",
      license: meta.license || "CC-BY-SA",
      isScorm: true,
      scormVersion: "2004",
      bodyClass: "exe-scorm exe-scorm2004",
      extraHeadScripts: this.getScorm2004HeadScripts(basePath),
      onLoadScript: "loadPage()",
      onUnloadScript: "unloadPage()"
    });
  }
  getScorm2004HeadScripts(basePath) {
    return `<script src="${basePath}libs/SCORM_API_wrapper.js"></script>
<script src="${basePath}libs/SCOFunctions.js"></script>`;
  }
  getScorm2004ApiWrapper() {
    return `/**
 * SCORM 2004 API Wrapper
 * Minimal implementation for SCORM 2004 communication
 */
var pipwerks = pipwerks || {};

pipwerks.SCORM = {
  version: "2004",
  API: { handle: null, isFound: false },
  data: { completionStatus: null, exitStatus: null },
  debug: { isActive: true }
};

pipwerks.SCORM.API.find = function(win) {
  var findAttempts = 0, findAttemptLimit = 500;
  while (!win.API_1484_11 && win.parent && win.parent !== win && findAttempts < findAttemptLimit) {
    findAttempts++;
    win = win.parent;
  }
  return win.API_1484_11 || null;
};

pipwerks.SCORM.API.get = function() {
  var win = window;
  if (win.parent && win.parent !== win) { this.handle = this.find(win.parent); }
  if (!this.handle && win.opener) { this.handle = this.find(win.opener); }
  if (this.handle) { this.isFound = true; }
  return this.handle;
};

pipwerks.SCORM.API.getHandle = function() {
  if (!this.handle) { this.get(); }
  return this.handle;
};

pipwerks.SCORM.connection = { isActive: false };

pipwerks.SCORM.init = function() {
  var success = false, API = this.API.getHandle();
  if (API) {
    success = API.Initialize("");
    if (success === "true" || success === true) {
      this.connection.isActive = true;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.quit = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Terminate("");
    if (success === "true" || success === true) {
      this.connection.isActive = false;
      success = true;
    }
  }
  return success;
};

pipwerks.SCORM.get = function(parameter) {
  var value = "", API = this.API.getHandle();
  if (API && this.connection.isActive) {
    value = API.GetValue(parameter);
  }
  return value;
};

pipwerks.SCORM.set = function(parameter, value) {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.SetValue(parameter, value);
    success = (success === "true" || success === true);
  }
  return success;
};

pipwerks.SCORM.save = function() {
  var success = false, API = this.API.getHandle();
  if (API && this.connection.isActive) {
    success = API.Commit("");
    success = (success === "true" || success === true);
  }
  return success;
};

// Shorthand
var scorm = pipwerks.SCORM;
`;
  }
  getSco2004Functions() {
    return `/**
 * SCO Functions for SCORM 2004
 * Page load/unload handlers for SCORM 2004 communication
 */

var startTimeStamp = null;
var exitPageStatus = false;

function loadPage() {
  startTimeStamp = new Date();
  var result = scorm.init();
  if (result) {
    var status = scorm.get("cmi.completion_status");
    if (status === "not attempted" || status === "unknown" || status === "") {
      scorm.set("cmi.completion_status", "incomplete");
    }
  }
  return result;
}

function unloadPage() {
  if (!exitPageStatus) {
    exitPageStatus = true;
    computeTime();
    scorm.set("cmi.exit", "suspend");
    scorm.save();
    scorm.quit();
  }
}

function computeTime() {
  if (startTimeStamp != null) {
    var now = new Date();
    var elapsed = now.getTime() - startTimeStamp.getTime();
    // SCORM 2004 uses ISO 8601 duration format
    var seconds = Math.round(elapsed / 1000);
    var hours = Math.floor(seconds / 3600);
    var mins = Math.floor((seconds - hours * 3600) / 60);
    var secs = seconds - hours * 3600 - mins * 60;
    // Format: PT#H#M#S
    var sessionTime = "PT" + hours + "H" + mins + "M" + secs + "S";
    scorm.set("cmi.session_time", sessionTime);
  }
}

function setComplete() {
  scorm.set("cmi.completion_status", "completed");
  scorm.set("cmi.success_status", "passed");
  scorm.save();
}

function setIncomplete() {
  scorm.set("cmi.completion_status", "incomplete");
  scorm.save();
}

function setScore(score, maxScore, minScore) {
  // SCORM 2004 score must be between 0 and 1
  var scaledScore = maxScore ? score / maxScore : score / 100;
  scorm.set("cmi.score.scaled", scaledScore);
  scorm.set("cmi.score.raw", score);
  if (maxScore !== undefined) scorm.set("cmi.score.max", maxScore);
  if (minScore !== undefined) scorm.set("cmi.score.min", minScore);
  scorm.save();
}
`;
  }
}

// src/shared/export/generators/ImsManifest.ts
class ImsManifestGenerator {
  projectId;
  pages;
  metadata;
  constructor(projectId, pages, metadata = {}) {
    this.projectId = projectId || this.generateId();
    this.pages = pages || [];
    this.metadata = metadata;
  }
  generateId() {
    return "exe-" + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  generate(options = {}) {
    const { commonFiles = [], pageFiles = {} } = options;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
`;
    xml += this.generateManifestOpen();
    xml += this.generateMetadata();
    xml += this.generateOrganizations();
    xml += this.generateResources(commonFiles, pageFiles);
    xml += `</manifest>
`;
    return xml;
  }
  generateManifestOpen() {
    return `<manifest identifier="eXe-MANIFEST-${this.escapeXml(this.projectId)}"
  xmlns="${IMS_NAMESPACES.imscp}"
  xmlns:imsmd="${IMS_NAMESPACES.imsmd}"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="${IMS_NAMESPACES.imscp} imscp_v1p1.xsd
    ${IMS_NAMESPACES.imsmd} imsmd_v1p2p2.xsd">
`;
  }
  generateMetadata() {
    const title = this.metadata.title || "eXeLearning";
    const description = this.metadata.description || "";
    const language = this.metadata.language || "en";
    const author = this.metadata.author || "";
    let xml = `  <metadata>
`;
    xml += `    <schema>IMS Content</schema>
`;
    xml += `    <schemaversion>1.1.3</schemaversion>
`;
    xml += `    <imsmd:lom>
`;
    xml += `      <imsmd:general>
`;
    xml += `        <imsmd:title>
`;
    xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(title)}</imsmd:langstring>
`;
    xml += `        </imsmd:title>
`;
    if (description) {
      xml += `        <imsmd:description>
`;
      xml += `          <imsmd:langstring xml:lang="${this.escapeXml(language)}">${this.escapeXml(description)}</imsmd:langstring>
`;
      xml += `        </imsmd:description>
`;
    }
    xml += `        <imsmd:language>${this.escapeXml(language)}</imsmd:language>
`;
    xml += `      </imsmd:general>
`;
    if (author) {
      xml += `      <imsmd:lifecycle>
`;
      xml += `        <imsmd:contribute>
`;
      xml += `          <imsmd:role>
`;
      xml += `            <imsmd:value>Author</imsmd:value>
`;
      xml += `          </imsmd:role>
`;
      xml += `          <imsmd:centity>
`;
      xml += `            <imsmd:vcard>BEGIN:VCARD\\nFN:${this.escapeXml(author)}\\nEND:VCARD</imsmd:vcard>
`;
      xml += `          </imsmd:centity>
`;
      xml += `        </imsmd:contribute>
`;
      xml += `      </imsmd:lifecycle>
`;
    }
    xml += `    </imsmd:lom>
`;
    xml += `  </metadata>
`;
    return xml;
  }
  generateOrganizations() {
    const orgId = `eXe-${this.projectId}`;
    const title = this.metadata.title || "eXeLearning";
    let xml = `  <organizations default="${this.escapeXml(orgId)}">
`;
    xml += `    <organization identifier="${this.escapeXml(orgId)}" structure="hierarchical">
`;
    xml += `      <title>${this.escapeXml(title)}</title>
`;
    xml += this.generateItems();
    xml += `    </organization>
`;
    xml += `  </organizations>
`;
    return xml;
  }
  generateItems() {
    const pageMap = new Map;
    for (const page of this.pages) {
      pageMap.set(page.id, page);
    }
    const rootPages = this.pages.filter((p) => !p.parentId);
    let xml = "";
    for (const page of rootPages) {
      xml += this.generateItemRecursive(page, pageMap, 3);
    }
    return xml;
  }
  generateItemRecursive(page, pageMap, indent) {
    const indentStr = "  ".repeat(indent);
    const isVisible = "true";
    const children = this.pages.filter((p) => p.parentId === page.id);
    let xml = `${indentStr}<item identifier="ITEM-${this.escapeXml(page.id)}" identifierref="RES-${this.escapeXml(page.id)}" isvisible="${isVisible}">
`;
    xml += `${indentStr}  <title>${this.escapeXml(page.title || "Page")}</title>
`;
    for (const child of children) {
      xml += this.generateItemRecursive(child, pageMap, indent + 1);
    }
    xml += `${indentStr}</item>
`;
    return xml;
  }
  generateResources(commonFiles, pageFiles) {
    let xml = `  <resources>
`;
    for (const page of this.pages) {
      const pageFile = pageFiles[page.id] || {};
      xml += this.generatePageResource(page, pageFile);
    }
    xml += this.generateCommonFilesResource(commonFiles);
    xml += `  </resources>
`;
    return xml;
  }
  generatePageResource(page, pageFile) {
    const pageId = page.id;
    const isIndex = this.pages.indexOf(page) === 0;
    const fileUrl = pageFile.fileUrl || (isIndex ? "index.html" : `html/${this.sanitizeFilename(page.title)}.html`);
    let xml = `    <resource identifier="RES-${this.escapeXml(pageId)}" type="webcontent" href="${this.escapeXml(fileUrl)}">
`;
    xml += `      <file href="${this.escapeXml(fileUrl)}"/>
`;
    const files = pageFile.files || [];
    for (const file of files) {
      xml += `      <file href="${this.escapeXml(file)}"/>
`;
    }
    xml += `      <dependency identifierref="COMMON_FILES"/>
`;
    xml += `    </resource>
`;
    return xml;
  }
  generateCommonFilesResource(commonFiles) {
    let xml = `    <resource identifier="COMMON_FILES" type="webcontent">
`;
    for (const file of commonFiles) {
      xml += `      <file href="${this.escapeXml(file)}"/>
`;
    }
    xml += `    </resource>
`;
    return xml;
  }
  escapeXml(str) {
    if (!str)
      return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
  sanitizeFilename(title) {
    if (!title)
      return "page";
    return title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").substring(0, 50);
  }
}

// src/shared/export/exporters/ImsExporter.ts
class ImsExporter extends Html5Exporter {
  manifestGenerator = null;
  constructor(document2, resources, assets, zip) {
    super(document2, resources, assets, zip);
  }
  getFileSuffix() {
    return "_ims";
  }
  async export(options) {
    const exportFilename = options?.filename || this.buildFilename();
    try {
      let pages = this.buildPageList();
      const meta = this.getMetadata();
      const themeName = meta.theme || "base";
      const projectId = this.generateProjectId();
      pages = await this.preprocessPagesForExport(pages);
      this.manifestGenerator = new ImsManifestGenerator(projectId, pages, {
        title: meta.title || "eXeLearning",
        language: meta.language || "en",
        author: meta.author || "",
        description: meta.description || "",
        license: meta.license || ""
      });
      const commonFiles = [];
      const pageFiles = {};
      for (let i2 = 0;i2 < pages.length; i2++) {
        const page = pages[i2];
        const isIndex = i2 === 0;
        const html = this.generateImsPageHtml(page, pages, meta, isIndex);
        const pageFilename = isIndex ? "index.html" : `html/${this.sanitizePageFilename(page.title)}.html`;
        this.zip.addFile(pageFilename, html);
        pageFiles[page.id] = {
          fileUrl: pageFilename,
          files: []
        };
      }
      this.zip.addFile("content/css/base.css", this.getBaseCss());
      commonFiles.push("content/css/base.css");
      try {
        const themeFiles = await this.resources.fetchTheme(themeName);
        for (const [path, content] of themeFiles) {
          this.zip.addFile(`theme/${path}`, content);
          commonFiles.push(`theme/${path}`);
        }
      } catch {
        this.zip.addFile("theme/content.css", this.getFallbackThemeCss());
        this.zip.addFile("theme/default.js", this.getFallbackThemeJs());
        commonFiles.push("theme/content.css", "theme/default.js");
      }
      try {
        const baseLibs = await this.resources.fetchBaseLibraries();
        for (const [path, content] of baseLibs) {
          this.zip.addFile(`libs/${path}`, content);
          commonFiles.push(`libs/${path}`);
        }
      } catch {}
      const usedIdevices = this.getUsedIdevices(pages);
      for (const idevice of usedIdevices) {
        try {
          const ideviceFiles = await this.resources.fetchIdeviceResources(idevice);
          for (const [path, content] of ideviceFiles) {
            this.zip.addFile(`idevices/${idevice}/${path}`, content);
            commonFiles.push(`idevices/${idevice}/${path}`);
          }
        } catch {}
      }
      await this.addAssetsToZipWithResourcePath();
      const manifestXml = this.manifestGenerator.generate({
        commonFiles,
        pageFiles
      });
      this.zip.addFile("imsmanifest.xml", manifestXml);
      const buffer = await this.zip.generateAsync();
      return {
        success: true,
        filename: exportFilename,
        data: buffer
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  generateProjectId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  generateImsPageHtml(page, allPages, meta, isIndex) {
    const basePath = isIndex ? "" : "../";
    const usedIdevices = this.getUsedIdevicesForPage(page);
    return this.pageRenderer.render(page, {
      projectTitle: meta.title || "eXeLearning",
      language: meta.language || "en",
      theme: meta.theme || "base",
      customStyles: meta.customStyles || "",
      allPages,
      basePath,
      isIndex,
      usedIdevices,
      author: meta.author || "",
      license: meta.license || "CC-BY-SA",
      bodyClass: "exe-web-site exe-ims"
    });
  }
}

// src/shared/export/browser/index.ts
function createExporter(format, documentManager, assetCache, resourceFetcher) {
  const document2 = new YjsDocumentAdapter(documentManager);
  const resources = new BrowserResourceProvider(resourceFetcher);
  const assets = new BrowserAssetProvider(assetCache);
  const zip = new JSZipZipProvider;
  const normalizedFormat = format.toLowerCase().replace("-", "");
  switch (normalizedFormat) {
    case "html5":
    case "web":
      return new Html5Exporter(document2, resources, assets, zip);
    case "html5sp":
    case "page":
      return new PageExporter(document2, resources, assets, zip);
    case "scorm12":
    case "scorm":
      return new Scorm12Exporter(document2, resources, assets, zip);
    case "scorm2004":
      return new Scorm2004Exporter(document2, resources, assets, zip);
    case "ims":
    case "imscp":
      return new ImsExporter(document2, resources, assets, zip);
    case "epub3":
    case "epub":
      throw new Error("EPUB3 export not yet implemented in shared code");
    case "elpx":
    case "elp":
      throw new Error("ELPX export not yet implemented in shared code");
    default:
      throw new Error(`Unknown export format: ${format}`);
  }
}
async function quickExport(format, documentManager, assetCache, resourceFetcher, options) {
  const exporter = createExporter(format, documentManager, assetCache, resourceFetcher);
  return exporter.export(options);
}
async function exportAndDownload(format, documentManager, assetCache, resourceFetcher, filename, options) {
  const exporter = createExporter(format, documentManager, assetCache, resourceFetcher);
  const result = await exporter.export(options);
  if (!result.success || !result.data) {
    throw new Error(result.error || "Export failed");
  }
  const extension = exporter.getFileExtension();
  const fullFilename = filename.endsWith(extension) ? filename : `${filename}${extension}`;
  const blob = new Blob([result.data], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fullFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return result;
}
if (typeof window !== "undefined") {
  const windowExports = {
    createExporter,
    quickExport,
    exportAndDownload,
    YjsDocumentAdapter,
    BrowserResourceProvider,
    BrowserAssetProvider,
    JSZipZipProvider,
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    Scorm2004Exporter,
    ImsExporter,
    IdeviceRenderer,
    PageRenderer,
    Scorm12ManifestGenerator,
    Scorm2004ManifestGenerator,
    ImsManifestGenerator,
    LomMetadataGenerator,
    LibraryDetector
  };
  window.SharedExporters = windowExports;
  window.createSharedExporter = createExporter;
  console.log("[SharedExporters] Browser export system loaded");
}
export {
  quickExport,
  exportAndDownload,
  createExporter,
  YjsDocumentAdapter,
  Scorm2004ManifestGenerator,
  Scorm2004Exporter,
  Scorm12ManifestGenerator,
  Scorm12Exporter,
  PageRenderer,
  PageExporter,
  LomMetadataGenerator,
  LibraryDetector,
  JSZipZipProvider,
  ImsManifestGenerator,
  ImsExporter,
  IdeviceRenderer,
  Html5Exporter,
  BrowserResourceProvider,
  BrowserAssetProvider
};
