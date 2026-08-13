import './polyfills';
import { use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { restore } from 'sinon';

use(chaiAsPromised);
use(sinonChai);

afterEach(() => {
  restore();
});
