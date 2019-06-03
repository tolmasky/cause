const { data, union, parameterized } = require("@algebraic/type");
const { List } = require("@algebraic/collections");
const Cause = require("@cause/cause");
const update = require("@cause/cause/update");

const Result = parameterized ((Success, Failure) =>
    union `Result<${Success}, ${Failure}>` (
        data `Success` ( value => Success ),
        data `Failure` ( value => Failure ) ) );

const Asynchronous = parameterized(function (Result)
{
    const Asynchronous = union `Asynchronous<${Result}>` (
        data `Waiting` (
            action => Function ),
        data `Running` (),
        Result);

    Asynchronous.bridge = action =>
        Asynchronous.Waiting({ action });

    return Asynchronous;
});

module.exports = Asynchronous;

const Dependent = union `Dependent` (
    data `Blocked` (
        action       => Function,
        dependencies => List(Dependency) ),
    data `DependenciesRunning` (
        action       => Function,
        dependencies => List(Dependency) ),
    data `Running` ( ),
    Result(Object, Object) );

const Dependency = union `Dependency` (
    Asynchronous,
    Dependent );

Asynchronous.p = function p(actionOrOperator)
{
    return (...dependencies) => Dependent.Blocked(
    {
        action: toAction(actionOrOperator),
        dependencies: List(Dependent)(dependencies)
    });
}

Asynchronous.p.state = Asynchronous.p;


Dependent.Blocked.update = update
    .on(Cause.Start, (blocked, event) =>
    {
        console.log("STARTED");
        return [blocked, []];
    })
    .on(Cause(Object).Started, (blocked, event, fromKeyPath) =>
        [Dependent.DependenciesRunning({ ...blocked }), []]);

Dependent.DependenciesRunning.update = update
    .on(Cause(Object).Started, (dependenciesRunning, event) =>
        [dependenciesRunning, []])
    .on(Cause(Object).Completed.Succeeded, (dependenciesRunning, event, fromKeyPath) =>
        [Result(Object, Object).Success({ value: event.value }), []]);

/*.state = function (actionOrOperator)
{
    const action = toAction(actionOrOperator);

    return function (...dependencies)
    {
        return Dependent.Blocked({ action, dependencies });
    }
}*/

const toAction = (function ()
{
    const operators =
    {
        "+": (lhs, rhs) => lhs + rhs,
        "-": (lhs, rhs) => lhs - rhs,
        "*": (lhs, rhs) => lhs * rhs,
        "/": (lhs, rhs) => lhs / rhs,
        "%": (lhs, rhs) => lhs / rhs,       
        "**": (lhs, rhs) => lhs ** rhs,
        "u(-)": value => -value,
        "u(+)": value => +value,

        "&": (lhs, rhs) => lhs & rhs,
        "|": (lhs, rhs) => lhs | rhs,
        "^": (lhs, rhs) => lhs ^ rhs,
        "<<": (lhs, rhs) => lhs << rhs,
        ">>": (lhs, rhs) => lhs >> rhs,
        ">>>": (lhs, rhs) => lhs >> rhs,
        "u(~)": value => ~value,

        "==": (lhs, rhs) => lhs == rhs,
        "===": (lhs, rhs) => lhs === rhs,
        "!=": (lhs, rhs) => lhs != rhs,
        "!==": (lhs, rhs) => lhs !== rhs,
        ">": (lhs, rhs) => lhs > rhs,
        ">=": (lhs, rhs) => lhs >= rhs,
        "<": (lhs, rhs) => lhs < rhs,
        "<=": (lhs, rhs) => lhs <= rhs,

        "&&": (lhs, rhs) => lhs == rhs,
        "||": (lhs, rhs) => lhs === rhs,
        "u(!)": value => !value,

        "u(typeof)": value => typeof value,
        "in": (lhs, rhs) => lhs in rhs,
        "instancoef": (lhs, rhs) => lhs instanceof rhs,
    };

    return actionOrOperator =>
        typeof actionOrOperator === "function" ?
            actionOrOperator :
            operators[actionOrOperator];
})();
