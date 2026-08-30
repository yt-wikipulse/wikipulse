import type { CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";

import styles from "./SegmentedTabs.module.scss";

export type SegmentedTabItem = {
  to: string;
  label: string;
};

export type SegmentedTabOption = {
  value: string;
  label: string;
};

type SegmentedTabsBaseProps = {
  ariaLabel: string;
  tabWidth?: number;
};

type SegmentedTabsLinkProps = SegmentedTabsBaseProps & {
  items: SegmentedTabItem[];
};

type SegmentedTabsValueProps = SegmentedTabsBaseProps & {
  items: SegmentedTabOption[];
  value: string;
  onChange: (value: string) => void;
};

type SegmentedTabsProps = SegmentedTabsLinkProps | SegmentedTabsValueProps;

function isValueMode(props: SegmentedTabsProps): props is SegmentedTabsValueProps {
  return "value" in props;
}

/**
 * Переключатель с ездящей пилюлей в двух режимах, и роль зависит от режима.
 *
 * В режиме навигации табы остаются ссылками: адрес в статусной строке,
 * открытие в новой вкладке, правильное объявление скринридером. В режиме
 * выбора значения (период дашборда, где навигации нет) контрол объявлен
 * радиогруппой. Ссылка, которая никуда не ведёт, врёт скринридеру ровно так же,
 * как радиогруппа врала бы про навигацию.
 *
 * Позиция индикатора считается по индексу активного элемента и задаётся
 * `transform`: анимация идёт на композиторе, а чисто CSS-вариант опирается
 * на соседний селектор после `:checked`, которого у ссылок нет. Ширина таба
 * фиксирована переменной `--segmented-tab-width`, и индикатор ездит на кратное
 * ей — раздел с длинной подписью требует увеличить переменную.
 *
 * Когда активного элемента нет (например, маршрут не из списка), индикатор
 * скрыт: подсвечивать первый таб было бы неправдой.
 *
 * Стрелки в радиогруппе не работают, все кнопки в Tab-порядке — известное
 * упрощение: полный roving tabindex это отдельное поведение со своим
 * состоянием фокуса.
 */
export function SegmentedTabs(props: SegmentedTabsProps) {
  const { ariaLabel, tabWidth } = props;
  const { pathname } = useLocation();

  const activeIndex = isValueMode(props)
    ? props.items.findIndex((item) => item.value === props.value)
    : props.items.findIndex((item) => item.to === pathname);

  const style = tabWidth
    ? ({ "--segmented-tab-width": `${tabWidth}px` } as CSSProperties)
    : undefined;

  const indicator = activeIndex >= 0 && (
    <span
      className={styles.segmentedTabs__indicator}
      style={{
        transform: `translateX(calc(var(--segmented-tab-width) * ${activeIndex}))`,
      }}
      aria-hidden="true"
    />
  );

  if (isValueMode(props)) {
    return (
      <div
        className={styles.segmentedTabs}
        role="radiogroup"
        aria-label={ariaLabel}
        style={style}
      >
        {indicator}

        {props.items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            className={styles.segmentedTabs__tab}
            aria-checked={item.value === props.value}
            onClick={() => props.onChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <nav className={styles.segmentedTabs} aria-label={ariaLabel} style={style}>
      {indicator}

      {props.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={styles.segmentedTabs__tab}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
