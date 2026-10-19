import { Component, type ReactNode } from 'react';

/** Any screen error shows a way back instead of a blank page. */
export default class Crash extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="main gutter"><div className="card">
        <b>حصلت مشكلة في الصفحة دي</b>
        <div className="note">بياناتك محفوظة. ارجع للرئيسية أو افتح التطبيق تاني.</div>
        <button className="btnp" onClick={() => { location.hash = '#/'; location.reload(); }}>ارجع للرئيسية</button>
      </div></main>
    );
  }
}
