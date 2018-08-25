const { Record, List, Map } = require("immutable");
const KeyPath = require("./key-path");

const fromMaybeTemplate = input =>
    Array.isArray(input) ? input[0] : input;
const isString = object => typeof object === "string";
const type = record => Object.getPrototypeOf(record).constructor;
const ANY_STATE = { };

const Event = Object.assign(
    typename => (fields, name) =>
        Event.map[Event.count] = Object.assign(
            NamedRecord(fields, `${typename}.${name}`),
            { id: Event.count++ }),
    { count: 0, map: [] });

Cause.Start = Event("Cause")({ }, "Start");

module.exports = Object.assign(Cause,
{
    Cause,
    field: declaration("field", "name"),
    event:
    {
        ignore: (state, event) => [state, []],
        bubble: (state, event) => [state, [event]],
        in: declaration("event.in", "name"),
        out: declaration("event.out", "name"),
        on: declaration("event.on", "on", { from:-1 }),
        from: declaration("event.on", "from"),
    },
    state: declaration("state", "name")
});

module.exports.update = require("./update");
module.exports.IO = require("./io");

function Cause(nameOrArray, declarations)
{
    if (arguments.length < 2)
        return declarations => Cause(nameOrArray, declarations);

    const typename = fromMaybeTemplate(nameOrArray);
    const definitions = getDefinitions(declarations);

    const init = declarations["init"];
    const create = (...args) =>
        type(...(init ? [init(...args)] : args));
    const fields = definitions.toObject("field");
    const eventsIn = definitions.toObject("event.in", Event(typename));
    const eventsOut = definitions.toObject("event.out", Event(typename));
    const type = NamedRecord(fields, typename);
    const update = toCauseUpdate(eventsIn, definitions);

    return Object.assign(type, { create, update }, eventsIn, eventsOut);
}

function getDefinitions(declarations)
{
    const definitions = List(Object.keys(declarations))
        .filter(key => key.charAt(0) === "{")
        .map(key => [JSON.parse(key), declarations[key]])
        .groupBy(([{ kind }]) => kind);
    const toMap = (key, transform = x => x) =>
        Map((definitions.get(key) || List())
            .map(([parsed, value]) =>
                [parsed.name, transform(value, parsed.name)]));
    const toObject = (key, transform = x => x) =>
        toMap(key, transform).toObject();
    const get = (key, missing) => definitions.get(key, missing);

    return { toMap, toObject, get };
}

function toCauseUpdate(eventsIn, definitions)
{
    const stateless =
        toEventDescriptions(eventsIn, ANY_STATE, definitions);
    const stateful = definitions.toMap("state", (value, name) =>
        toEventDescriptions(eventsIn, name, getDefinitions(value)))
        .valueSeq().flatten();
    const handlers = stateful.concat(stateless);
    const hasStatefulUpdates = stateful.size > 0;

    return function update(state, event, keyPath)
    {
        const etype = type(event);
        const match = handlers.find(({ on, from, inState }) =>
            (on === false || on.id === etype.id) &&
            (!from || KeyPath.equal(keyPath, from)) &&
            (inState === ANY_STATE || state.state === inState));

        if (!match)
        {
            const rname = type(state).name;
            const ename = etype.name;
            const inStateMessage = hasStatefulUpdates?
                "" : ` in state ${state.state}`;

            throw Error(
                `${rname} does not respond to ${ename}${inStateMessage}`);
        }

        const result = match.update(state, event);

        return Array.isArray(result) ? result : [result, []];
    }
}

function toEventDescriptions(eventsIn, inState, definitions)
{
    return definitions
        .get("event.on", List())
        .map(([{ on, from, name }, update]) =>
        ({
            name, update, inState,
            on: (!!on && on !== "*") &&
                (isString(on) ? eventsIn[on] : on),
            from: !!from && KeyPath.from(from)
        }));
}

function declaration(previous, key, routes = { })
{
    const rest = isString(previous) ?
        { kind: previous } : previous;
    const toObject = value =>
        ({ ...rest, [key]: value instanceof Function ?
            { id: value.id, name: value.name } :
            fromMaybeTemplate(value) });
    const f = value => Object.keys(routes)
        .reduce((object, key) => Object.assign(object,
            { [key]: declaration(toObject(value), key, routes[key]) }),
            { toString: () => JSON.stringify(toObject(value)) });

    return Object.assign(f, f(false));
}

function NamedRecord(fields, name)
{
    const constructor = Record(fields, name);

    Object.defineProperty(constructor, "name", { value: name });

    return constructor;
}
