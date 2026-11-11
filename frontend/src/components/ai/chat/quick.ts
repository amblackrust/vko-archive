/** Ключи быстрых вопросов помощника (ai.widget.quick.<id>); общий список для панели и страницы. */
export const QUICK_QUESTIONS = ["certificate", "fund", "ridder", "hours"] as const;

/** Событие окна «задать вопрос помощнику»: его шлют кнопки-примеры вне диалога, слушает Chat. */
export const ASK_EVENT = "assistant:ask";

/** Событие окна «открыть помощника с этим вопросом»: кнопки на страницах фонда и документа. */
export const OPEN_EVENT = "assistant:open";
