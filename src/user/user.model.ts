import {
  IMongoloquentSchema,
  IMongoloquentSoftDelete,
  IMongoloquentTimestamps,
  Model,
} from 'mongoloquent';

export type RoleUser = 'admin' | 'groomer' | 'customer';

export interface IUser
  extends
    IMongoloquentSchema,
    IMongoloquentTimestamps,
    IMongoloquentSoftDelete {
  username: string;
  email: string;
  password: string;
  role: RoleUser;
  is_active: boolean;
}

export class User extends Model<IUser> {
  public static $schema: IUser;
  protected $collection: string = 'users';
  protected $useSoftDelete: boolean = true;
}
