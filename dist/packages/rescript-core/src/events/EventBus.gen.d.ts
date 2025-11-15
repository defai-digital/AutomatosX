import type { Json_t as Js_Json_t } from './Js.gen';
import type { Map_String_t as Belt_Map_String_t } from './Belt.gen';
export type eventId = string;
export type subscriberId = string;
export type eventPattern = string;
export type eventPriority = number;
export type eventData = {
    readonly id: eventId;
    readonly eventType: string;
    readonly payload: Js_Json_t;
    readonly timestamp: number;
    readonly source: (undefined | string);
    readonly metadata: (undefined | {
        [id: string]: string;
    });
    readonly priority: eventPriority;
};
export type eventHandler = (_1: eventData) => Promise<{
    TAG: "Ok";
    _0: void;
} | {
    TAG: "Error";
    _0: string;
}>;
export type subscription = {
    readonly id: subscriberId;
    readonly pattern: eventPattern;
    readonly handler: eventHandler;
    readonly priority: eventPriority;
    readonly active: boolean;
    readonly createdAt: number;
};
export type eventBusConfig = {
    readonly maxHistorySize: number;
    readonly enableHistory: boolean;
    readonly enableFiltering: boolean;
    readonly defaultPriority: eventPriority;
};
export type eventBus = {
    readonly subscriptions: Belt_Map_String_t<subscription>;
    readonly history: eventData[];
    readonly config: eventBusConfig;
    eventCount: number;
    errorCount: number;
};
export type eventFilter = {
    readonly eventType: (undefined | string);
    readonly source: (undefined | string);
    readonly startTime: (undefined | number);
    readonly endTime: (undefined | number);
    readonly limit: (undefined | number);
};
export type eventBusStats = {
    readonly totalEvents: number;
    readonly totalSubscribers: number;
    readonly activeSubscribers: number;
    readonly historySize: number;
    readonly errorCount: number;
    readonly averageHandlers: number;
};
export declare const createConfig: (maxHistorySize: (undefined | number), enableHistory: (undefined | boolean), enableFiltering: (undefined | boolean), defaultPriority: (undefined | eventPriority), _5: void) => eventBusConfig;
export declare const create: (config: (undefined | eventBusConfig), param: void) => eventBus;
export declare const subscribe: (bus: eventBus, pattern: eventPattern, handler: eventHandler, priority: (undefined | eventPriority), param: void) => {
    TAG: "Ok";
    _0: eventBus;
    _1: subscriberId;
} | {
    TAG: "Error";
    _0: string;
};
export declare const unsubscribe: (bus: eventBus, subscriberId: subscriberId) => {
    TAG: "Ok";
    _0: eventBus;
} | {
    TAG: "Error";
    _0: string;
};
export declare const pauseSubscription: (bus: eventBus, subscriberId: subscriberId) => {
    TAG: "Ok";
    _0: eventBus;
} | {
    TAG: "Error";
    _0: string;
};
export declare const resumeSubscription: (bus: eventBus, subscriberId: subscriberId) => {
    TAG: "Ok";
    _0: eventBus;
} | {
    TAG: "Error";
    _0: string;
};
export declare const getSubscription: (bus: eventBus, subscriberId: subscriberId) => (undefined | subscription);
export declare const getAllSubscriptions: (bus: eventBus) => subscription[];
export declare const getActiveSubscriptions: (bus: eventBus) => subscription[];
export declare const createEvent: (eventType: string, payload: Js_Json_t, source: (undefined | string), metadata: (undefined | {
    [id: string]: string;
}), priority: (undefined | eventPriority), param: void) => eventData;
export declare const publish: (bus: eventBus, event: eventData) => Promise<Promise<{
    TAG: "Ok";
    _0: eventBus;
} | {
    TAG: "Error";
    _0: string;
}>>;
export declare const publishSync: (bus: eventBus, event: eventData) => {
    TAG: "Ok";
    _0: eventBus;
} | {
    TAG: "Error";
    _0: string;
};
export declare const getHistory: (bus: eventBus, filter: (undefined | eventFilter), param: void) => eventData[];
export declare const clearHistory: (bus: eventBus) => eventBus;
export declare const getEvent: (bus: eventBus, eventId: eventId) => (undefined | eventData);
export declare const getEventsByType: (bus: eventBus, eventType: string, limit: (undefined | number), param: void) => eventData[];
export declare const getEventsBySource: (bus: eventBus, source: string, limit: (undefined | number), param: void) => eventData[];
export declare const getRecentEvents: (bus: eventBus, count: number) => eventData[];
export declare const getStats: (bus: eventBus) => eventBusStats;
export declare const hasSubscribers: (bus: eventBus, pattern: eventPattern) => boolean;
export declare const getSubscriberCount: (bus: eventBus, pattern: eventPattern) => number;
export declare const reset: (bus: eventBus) => eventBus;
export declare const createFilter: (eventType: (undefined | string), source: (undefined | string), startTime: (undefined | number), endTime: (undefined | number), limit: (undefined | number), param: void) => eventFilter;
//# sourceMappingURL=EventBus.gen.d.ts.map