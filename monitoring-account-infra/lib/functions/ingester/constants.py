from enum import Enum

class SAGEMAKER_STAGE_CHANGE_EVENT(Enum):
  PROCESSING_JOB = "SageMaker Processing Job State Change",
  TRAINING_JOB = "SageMaker Training Job State Change"
  HYPERPARAMETER_JOB = "SageMaker HyperParameter Tuning Job State Change"
  TRANFORM_JOB = "SageMaker Transform Job State Change"
  ENDPOINT = "SageMaker Endpoint State Change"
  FEATURE_GROUP = "SageMaker Feature Group State Change"
  MODEL_PACKAGE = "SageMaker Model Package State Change"
  PIPELINE_EXECUTION = "SageMaker Model Building Pipeline Execution Status Change"
  PIPELINE_STEP = "SageMaker Model Building Pipeline Execution Step Status Change"
  IMAGE = "SageMaker Image State Change"
  IMAGE_VERSION = "SageMaker Image Version State Change"
  ENDPOINT_DEPLOYMENT = "SageMaker Endpoint Deployment State Change"