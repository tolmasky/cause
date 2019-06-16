const { fromAsyncCall } = require("@cause/task");
const toPooled = require("@cause/task/transform/to-pooled");
const toLambdaForm = require("@cause/task/transform/to-lambda-form");
const toPromise = require("@cause/cause/to-promise");
const spawn = require("@cause/task/spawn");
const map = require("@cause/task/map");
const { write } = require("@cause/task/fs");

async function show(f, ...args)
{
    const v_to_t = f => (...args) =>
        fromAsyncCall(async () => (await 0, f(...args)));

    const v =
    {
        v_id: x => x,
        v_add: (a, b) => a + b,
        v_num: x => x,
        v_double: x => x + x,
        v_log: x => console.log
    };
    const t = Object.fromEntries(
        Object.entries(v).map(([key, v]) => [key.replace(/^v/, "t"), v_to_t(v)]));

    v.v_t_add = () => t.t_add;
    t.t_t_add = v_to_t(v.v_t_add);

    t.t_spawn = spawn;
    t.t_map = map;
    t.t_write = write;
    t.t_if = toPooled(["t_id"], condition =>
    {
        if (t_id(condition))
            return t_id(true);

        return false;
    }, { t_id: t.t_id });
    t.t_mapper = toPooled(["t_id", "t_map"], items =>
    {
        if (items.length)
        {
            const o = console.log("here!");

            return t_map(t_id, items);
        }
        const i = console.log("a");

        return items;
    }, t);
    t.t_earlyReturn = toPooled("t_id", () =>
    {
        if (true)
            return 17;

        const setup = t_id(10);

        return setup + 1;
    }, t);

    const free = { ...v, ...t, console };
    const symbols = Object.keys(t);

    console.log("Original " + f);

    const fTask = toPooled(symbols, f, free);

    console.log("Lambda Form: " + toLambdaForm(f, free));
    console.log("Task Form: " + fTask);

    const task = fTask(...args);
console.log(task);
    console.log("Result:", await toPromise(Object, task));
}

(async function (...tests)
{
    await show(tests[21], 3);
})(
/* 0*/ () => 1, /* broken - correct? */

/* 1*/ () => t_num(1),

/* 2*/ () => t_num(1) + t_num(1),

/* 3*/ () => t_num(1) + t_num(1) + t_num(1),

/* 4*/ () => v_add(t_num(1), t_num(1)),

/* 5*/ () => t_add(t_num(1), t_num(1)),

/* 6*/ () => t_double(t_add(t_num(1), t_num(1))),

/* 7*/ () => v_add(t_num(1), t_num(1)),

/* 8*/ () => t_spawn("ls", ["."]).stdout.split("\n")[0],

/* 9*/ () => (array => t_id(array))(t_spawn("ls", ["."]).stdout.split("\n")),

/*10*/ () => (array => t_spawn("ls", [`./${array[0]}`]))(t_spawn("ls", ["."]).stdout.split("\n")),

/*11*/ () => t_spawn("ls", ["./" + t_spawn("ls", ["."]).stdout.split("\n")[0]]).stdout,

/*12*/ () => t_map(t_id, [1,2,3,4]),

/*13*/ () => { if (false) return t_id(1); return 12; },

/*14*/ () => {
    const temporary = (function ()
    {
        if (false) return t_id(1); return 12;
    })();

    return temporary + 2;
},

/*15*/ () => {
    const items = t_map(t_id, [1,2,3,9]);
    //const results = console.log("RESULTS: " + items);

    return items;
},

/*16*/ function x(recurse)
{
    if (recurse <= 0)
        return t_id(1);

    const next = t_id(recurse - 1);
    const items = t_map(x, [next, next, next, next]);

    if (recurse < 3)
        return t_id(items);

    const path = t_write(`./${items.join("-")}.txt`, "hi", "utf-8");
    const path2 = t_write(`./${path.length}.txt`, path, "utf-8");

    return t_id(path2);
},

/*17*/ (x) => {
    if (false)
        return t_id(3);

    return 4;
},

/*18*/ (x) => {
    const inbetween = t_mapper([0, 1, 0, 1]);
    const results = t_map(t_if, inbetween);
    const tt = console.log(results);
    const addition = t_id(1) + t_id(2);

    return addition;
},

/*19*/ (x) => {
    const result = t_map(function (x)
    {
        if (x < 10)
            return 10;

        const first = t_id(x);
        const second = t_id(1);
        const y = t_map(function() { if (true) return t_id(1); return 9; }, [1,2,3])

        return first + second;// + y[0];
    }, [1, 10, 10, 10]);

    return result;
},

/*20*/ (x) => {
    const setup = t_id(10);
    const result = t_map(function (x)
    {
        if (x < 10)
            return 10;

        const first = t_id(x);
        const second = t_id(1);
        const y = t_map(function() { if (true) return t_id(1); return 9; }, [1,2,3])

        return first + second;// + y[0];
    }, []);
    const length = setup + t_id(result.length) + 1;

    return length;
},


/*20*/ () => {

    const x = t_earlyReturn(20);

    return x;
//    return t_map(() => t_earlyReturn(20), [1,2,3,4]);
}

)




