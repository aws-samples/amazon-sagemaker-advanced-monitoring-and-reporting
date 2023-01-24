import os
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

def plot_chart():
  df2 = pd.DataFrame(np.random.rand(10, 4), columns=["a", "b", "c", "d"])
  df2.plot.bar(stacked=True)
  plt.savefig("/tmp/test.png")
  return None