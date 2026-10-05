// Arial ASCII advances at font-size 100, adapted from string-pixel-width 1.11.0.
// https://github.com/adambisek/string-pixel-width
/*
MIT License

Copyright (c) 2023 Adam Ernst Bisek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Entries correspond to printable ASCII characters (space through tilde).
// Italic and upright variants have the same character advances.
const ARIAL_WIDTHS = [
  28, 28, 35, 56, 56, 89, 67, 19, 33, 33, 39, 58, 28, 33, 28, 28, 56, 56, 56,
  56, 56, 56, 56, 56, 56, 56, 28, 28, 58, 58, 58, 56, 102, 67, 67, 72, 72, 67,
  61, 78, 72, 28, 50, 67, 56, 83, 72, 78, 67, 78, 72, 67, 61, 72, 67, 94, 67,
  67, 61, 28, 28, 28, 47, 56, 33, 56, 56, 50, 56, 56, 28, 56, 56, 22, 22, 50,
  22, 83, 56, 56, 56, 56, 33, 50, 28, 56, 50, 72, 50, 50, 50, 33, 26, 33, 58,
]
const ARIAL_BOLD_WIDTHS = [
  28, 33, 47, 56, 56, 89, 72, 24, 33, 33, 39, 58, 28, 33, 28, 28, 56, 56, 56,
  56, 56, 56, 56, 56, 56, 56, 33, 33, 58, 58, 58, 61, 98, 72, 72, 72, 72, 67,
  61, 78, 72, 28, 56, 72, 61, 83, 72, 78, 67, 78, 72, 67, 61, 72, 67, 94, 67,
  67, 61, 33, 28, 33, 58, 56, 33, 56, 61, 56, 61, 56, 33, 61, 61, 28, 28, 56,
  28, 89, 61, 61, 61, 61, 39, 56, 33, 61, 56, 78, 56, 56, 50, 39, 28, 39, 58,
]

export function getArialTextWidth(
  text: string,
  fontSize: number,
  bold: boolean,
): number {
  const widths = bold ? ARIAL_BOLD_WIDTHS : ARIAL_WIDTHS
  let width = 0
  for (const character of text) {
    width += widths[character.charCodeAt(0) - 32] ?? 80
  }
  return width * (fontSize / 100)
}
