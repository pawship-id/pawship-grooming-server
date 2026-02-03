import {
  IMongoloquentSchema,
  IMongoloquentTimestamps,
  Model,
} from 'mongoloquent';

export interface IUserAuth
  extends IMongoloquentSchema, IMongoloquentTimestamps {
  username: string;
  email: string;
  password: string;
}

export class User extends Model<IUserAuth> {
  public static $schema: IUserAuth;
  protected $collection: string = 'users';
}
