// Web shim for react-native-pager-view (native-only module).
// Renders a paged ScrollView (horizontal or vertical) with onPageSelected parity.
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';

const PagerView = forwardRef((props, ref) => {
  const {
    children,
    style,
    initialPage = 0,
    onPageSelected,
    orientation = 'horizontal',
    ...rest
  } = props;
  const scrollRef = useRef(null);
  const { width, height } = useWindowDimensions();
  const pageSize = orientation === 'vertical' ? height : width;
  const [index, setIndex] = useState(initialPage);

  const notify = (i) => {
    if (i !== index) {
      setIndex(i);
      if (onPageSelected) onPageSelected({ nativeEvent: { position: i } });
    }
  };

  useImperativeHandle(ref, () => ({
    setPage: (n) => {
      scrollRef.current?.scrollTo(
        orientation === 'vertical'
          ? { y: n * pageSize, animated: true }
          : { x: n * pageSize, animated: true }
      );
      notify(n);
    },
    setPageWithoutAnimation: (n) => {
      scrollRef.current?.scrollTo(
        orientation === 'vertical'
          ? { y: n * pageSize, animated: false }
          : { x: n * pageSize, animated: false }
      );
      notify(n);
    },
  }));

  return (
    <ScrollView
      ref={scrollRef}
      horizontal={orientation !== 'vertical'}
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      style={style}
      onMomentumScrollEnd={(e) => {
        const offset =
          orientation === 'vertical'
            ? e.nativeEvent.contentOffset.y
            : e.nativeEvent.contentOffset.x;
        notify(Math.round(offset / pageSize));
      }}
      {...rest}
    >
      {React.Children.map(children, (child) => (
        <View
          style={
            orientation === 'vertical'
              ? { height: pageSize, width: '100%' }
              : { width: pageSize, height: '100%' }
          }
        >
          {child}
        </View>
      ))}
    </ScrollView>
  );
});

PagerView.displayName = 'PagerView';
export default PagerView;
