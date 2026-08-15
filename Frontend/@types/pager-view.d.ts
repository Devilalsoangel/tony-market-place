declare module 'react-native-pager-view' {
  import React from 'react';
  import { ViewProps } from 'react-native';

  interface PagerViewOnPageSelectedEvent {
    nativeEvent: { position: number };
  }

  interface PagerViewProps extends ViewProps {
    initialPage?: number;
    onPageSelected?: (event: PagerViewOnPageSelectedEvent) => void;
    style?: any;
    children?: React.ReactNode;
  }

  export default class PagerView extends React.Component<PagerViewProps> {}
}
