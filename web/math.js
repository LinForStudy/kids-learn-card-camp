const MATH_LEVELS = [
  { id: "add20", name: "20以内加减", desc: "适合热身", reward: 2 },
  { id: "compare", name: "比大小", desc: "看清数字关系", reward: 2 },
  { id: "pattern", name: "找规律", desc: "观察数列", reward: 3 },
  { id: "add100", name: "100以内加减", desc: "进阶计算", reward: 3 },
  { id: "multiply", name: "乘法启蒙", desc: "表内乘法", reward: 4 }
];

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleList(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function uniqueOptions(answer, candidates, count) {
  if (!count) count = 4;
  var values = [answer];
  
  var pool = candidates.filter(function (item) { return item !== answer; });
  for (var i = 0; i < pool.length && values.length < count; i++) {
    if (values.indexOf(pool[i]) === -1) values.push(pool[i]);
  }
  
  var n = 0;
  while (values.length < count) {
    n++;
    var extra = String(parseInt(answer, 10) + count + n);
    if (values.indexOf(extra) === -1) values.push(extra);
  }
  
  return shuffleList(values);
}

function makeMathQuestion(levelIndex) {
  const level = MATH_LEVELS[Math.max(0, Math.min(levelIndex, MATH_LEVELS.length - 1))];
  if (level.id === "compare") {
    const a = randInt(5, 99);
    const b = randInt(5, 99);
    const answer = a > b ? ">" : a < b ? "<" : "=";
    return { level, prompt: `${a}  ?  ${b}`, hint: "选择正确的符号", answer, options: shuffleList([">", "<", "=", "≠"]) };
  }
  if (level.id === "pattern") {
    const start = randInt(1, 12);
    const step = randInt(2, 9);
    const answer = start + step * 3;
    return {
      level,
      prompt: `${start}, ${start + step}, ${start + step * 2}, ?`,
      hint: "找一找每次加多少",
      answer: String(answer),
      options: uniqueOptions(String(answer), [String(answer + step), String(answer - step), String(answer + 1)])
    };
  }
  if (level.id === "add100") {
    const add = Math.random() > 0.5;
    const a = randInt(20, 80);
    const b = randInt(8, 19);
    const answer = add ? a + b : a - b;
    return {
      level,
      prompt: add ? `${a} + ${b} = ?` : `${a} - ${b} = ?`,
      hint: "可以先算十位，再算个位",
      answer: String(answer),
      options: uniqueOptions(String(answer), [String(answer + 10), String(answer - 10), String(answer + 1)])
    };
  }
  if (level.id === "multiply") {
    const a = randInt(2, 9);
    const b = randInt(2, 5);
    const answer = a * b;
    return {
      level,
      prompt: `${a} × ${b} = ?`,
      hint: "把相同的数加几次",
      answer: String(answer),
      options: uniqueOptions(String(answer), [String(answer + a), String(answer - a), String(answer + 2)])
    };
  }
  const add = Math.random() > 0.35;
  const a = randInt(2, 18);
  const b = randInt(1, add ? 10 : Math.min(10, a));
  const answer = add ? a + b : a - b;
  return {
    level,
    prompt: add ? `${a} + ${b} = ?` : `${a} - ${b} = ?`,
    hint: "慢慢算，不着急",
    answer: String(answer),
    options: uniqueOptions(String(answer), [String(answer + 1), String(answer - 1), String(answer + 2)])
  };
}
