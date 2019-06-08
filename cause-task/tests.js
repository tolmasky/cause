const { fromAsyncCall } = require("@cause/task");
const toPooled = require("@cause/task/transform/to-pooled");
const toLambdaForm = require("@cause/task/transform/to-lambda-form");
const toPromise = require("@cause/cause/to-promise");
const spawn = require("@cause/task/spawn");
const map = require("@cause/task/map");

const returnNumber = number => () => fromAsyncCall(async () => (await 0, number));

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

console.log(t.t_t_add());
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
    await show(tests[15]);
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

/*14*/ () => {
    const items = t_map(t_id, [1,2,3,4]);
    //const results = console.log("RESULTS: " + items);

    return items;
}


)




