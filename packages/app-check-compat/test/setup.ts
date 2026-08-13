import './polyfills';
import { use } from 'chai';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import { restore } from 'sinon';

use(sinonChai);
use(chaiAsPromised);

afterEach(() => {
  restore();
});
