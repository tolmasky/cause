const push = (item, array) => (array.push(item), array);
const unfold = (f, v, into = []) =>
    (result => result === false ?
        into : push(result[0], unfold(f, result[1], into)))
    (f(v));

module.exports = unfold;
