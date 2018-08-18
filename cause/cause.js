const { Record, List, Map } = require("immutable");
const fromMaybeTemplate = input =>
    typeof input === "string" ? input : input[0];
const type = record => Object.getPrototypeOf(record).constructor;

const Event = Object.assign(
    typename => (fields, name) =>
        Event.map[Event.count] = Object.assign(
            Record(fields, `${typename}.${name}`),
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
        expose: (state, event) => [state, [event]],
        in: declaration("event.in", "name"),
        out: declaration("event.out", "name"),
        on: declaration("event.on", "on", { from:-1 }),
        from: declaration("event.on", "from")
    }
});

function Cause(nameOrArray, declarations)
{
    if (arguments.length < 2)
        return declarations => Cause(nameOrArray, declarations);

    const typename = fromMaybeTemplate(nameOrArray);
    const definitions = List(Object.keys(declarations))
        .filter(key => key.charAt(0) === "{")
        .map(key => [JSON.parse(key), declarations[key]])
        .groupBy(([{ kind }]) => kind);

    const toObject = (key, transform = x => x) =>
        (pairs => Map(pairs).toObject())
        ((definitions.get(key) || List())
            .map(([parsed, value]) =>
                [parsed.name, transform(value, parsed.name)]));

    const init = declarations["init"];
    const create = (...args) => 
        type(...(init ? [init(...args)] : args));
    const fields = toObject("field");
    const eventsIn = toObject("event.in", Event(typename));
    const eventsOut = toObject("event.out", Event(typename));
    const type = Record(fields, typename);
    const update = toCauseUpdate(definitions
        .get("event.on", List())
        .map(toEventUpdate(eventsIn)));

    Object.defineProperty(type, "name", { value: typename });

    return Object.assign(type, { create, update }, eventsIn, eventsOut);
}

function toEventUpdate(eventsIn)
{
    return function ([{ on, from }, update])
    {
        const id = !!on && on !== "*" &&
            (typeof on === "string" ? eventsIn[on].id : on.id);

        return { on: id, from: from && [].concat(from), update };
    }
}

function toCauseUpdate(handlers)
{
    return function update(state, event, source)
    {console.log("here?");
        const etype = type(event);
        const match = handlers.find(({ on, from }) =>
            (on === false || on === etype.id) &&
            (!from || state.getIn(from) === source));

        if (!match)
            throw Error(
                `${type(state).name} does not respond to ${etype.name}`);
console.log(match.update + "" + type(state).name, match)
        const result = match.update(state, event, source);

        return Array.isArray(result) ? result : [result, []];
    }
}

function declaration(previous, key, routes = { })
{
    const rest = typeof previous === "string" ?
        { kind: previous } : previous;
    const toObject = value =>
        ({ ...rest, [key]: value instanceof Function ? 
            { id: value.id } : fromMaybeTemplate(value) });
    const f = value => Object.keys(routes)
        .reduce((object, key) => Object.assign(object,
            { [key]: declaration(toObject(value), key, routes[key]) }),
            { toString: () => JSON.stringify(toObject(value)) });

    return Object.assign(f, f("*"));
}
